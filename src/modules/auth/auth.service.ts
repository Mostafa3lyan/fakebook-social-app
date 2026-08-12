
import { HashApproachEnum } from "../../common/enums/security.enum";
import { ProviderEnum } from "../../common/enums/user.enum";
import { EmailSubjectEnum } from "../../common/enums";
import { createOtp, emailEmitter, magicLinkTemplate, sendEmail } from "../../common/utils/index";
import {
  compareHash,
  encryptGenerator,
  generateHash,
} from "../../common/utils/security/index";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  TooManyRequestsException,
  UnauthorizedException,
} from "../../common/exceptions/index";
import { RedisService, redisService } from "../../common/services/redis.service";
import { UserRepository } from "./../../DB/repository/user.repository";
import { IUser } from "../../common/interfaces";
import { SignupDto } from "./auth.dto";
import { LoginDto } from "./auth.validation";
import { CLIENT_URL, GOOGLE_CLIENT_ID, MAGIC_LINK_SECRET } from "../../config/config.service";
import { TokenService } from "../../common/services";
import { ILoginResponse } from './auth.entity';

class AuthenticationService {
  private readonly userRepository: UserRepository;
  private readonly redis: RedisService; 
  private readonly tokenService: TokenService;

  private readonly MAX_ATTEMPTS = 3;
  private readonly BLOCK_TTL = 60 * 60; // 1 hour

  // constructor
  constructor() {
    this.redis = redisService; // reuse the singleton — do not `new RedisService()`
    this.userRepository = new UserRepository();
    this.tokenService = new TokenService();
  }


  // OTP core
  // ===========================

  // generateHashedOtp
  private generateHashedOtp = async (email: string, subject: EmailSubjectEnum): Promise<number> => {
    const payload = { email, subject };

    const isBlocked = await this.redis.get(this.redis.otpBlockKey(payload));
    if (isBlocked) {
      const remaining = await this.redis.ttl(this.redis.otpBlockKey(payload));
      throw new TooManyRequestsException(
        `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      );
    }

    const attempts = await this.redis.incr(this.redis.otpAttemptsKey(payload));
    if (attempts === 1) await this.redis.expire(this.redis.otpAttemptsKey(payload), this.BLOCK_TTL);

    if (attempts > this.MAX_ATTEMPTS) {
      await this.redis.set(this.redis.otpBlockKey(payload), "1", this.BLOCK_TTL);
      await this.redis.del(this.redis.otpAttemptsKey(payload));
      throw new TooManyRequestsException(
        `Too many attempts. Try again in ${this.BLOCK_TTL / 60} minutes.`,
      );
    }

    const code = await createOtp();
    await this.redis.set(this.redis.otpKey(payload), await generateHash({ plainText: `${code}` }), 300);
    return code;
  };

  // sendEmailWithOtp
  private sendEmailWithOtp = async (
    email: string,
    title: string,
    subject: EmailSubjectEnum,
  ): Promise<void> => {
    const code = await this.generateHashedOtp(email, subject);

    emailEmitter.emit("sendOtpEmail", { to: email, title, subject, code });
  };

  // Signup / email confirmation
  // ===========================

  // signup
  public signup = async (data: SignupDto): Promise<IUser> => {
    const { fullName, email, password, phone } = data as any;

    const emailExist = await this.userRepository.findOne({ filter: { email } });
    if (emailExist) {
      throw new ConflictException("Email already exist");
    }

    const [user] = await this.userRepository.create({
      data: [
        {
          fullName,
          email,
          password: await generateHash({ plainText: password }),
          phone: await encryptGenerator({ plainText: phone }),
        },
      ],
    });

    if (!user) {
      throw new BadRequestException("User not created");
    }

    await this.sendEmailWithOtp(email, "email address", EmailSubjectEnum.Confirm_EMAIL);

    return user.toJSON();
  };

  // confirmEmail
  public confirmEmail = async ({ email, otp }: { email: string; otp: string }): Promise<void> => {
    const payload = { email, subject: EmailSubjectEnum.Confirm_EMAIL };

    const account = await this.userRepository.findOne({
      filter: { email, emailConfirmedAt: { $exists: false }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("cannot find account with this email");
    }

    const storedHashedOtp = await this.redis.get(this.redis.otpKey(payload));
    if (!storedHashedOtp) {
      throw new BadRequestException("OTP has expired or is invalid");
    }

    const match = await compareHash({ plainText: `${otp}`, cipherText: storedHashedOtp as string });
    if (!match) {
      throw new BadRequestException("Invalid OTP");
    }

    account.emailConfirmedAt = new Date();
    await account.save();

    await this.redis.del([
      this.redis.otpKey(payload),
      this.redis.otpAttemptsKey(payload),
      this.redis.otpBlockKey(payload),
    ]);
  };

  // reSendConfirmEmail
  public reSendConfirmEmail = async ({ email }: { email: string }): Promise<void> => {
    const payload = { email, subject: EmailSubjectEnum.Confirm_EMAIL };

    const account = await this.userRepository.findOne({
      filter: { email, emailConfirmedAt: { $exists: false }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("cannot find account with this email");
    }

    const otpTtl = await this.redis.ttl(this.redis.otpKey(payload));
    if (otpTtl > 0) {
      throw new ConflictException(`Please wait ${otpTtl} seconds before requesting a new otp.`);
    }

    await this.sendEmailWithOtp(email, "email address", EmailSubjectEnum.Confirm_EMAIL);
  };

  // Password reset (magic link + OTP)
  // ===========================

  // sendMagicLink
  private sendMagicLink = async (email: string, userId: string): Promise<void> => {
    const token = generateToken({ payload: { userId }, secret: MAGIC_LINK_SECRET, expiresIn: "15m" });
    const link = `${CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail({ to: email, subject: "reset your password", html: magicLinkTemplate(link) });
  };

  // forgotPassword
  public forgotPassword = async ({ email, method = "otp" }: { email: string; method?: "otp" | "link" }): Promise<void> => {
    const account = await this.userRepository.findOne({
      filter: { email, emailConfirmedAt: { $exists: true }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("Cannot find account with this email");
    }

    if (method === "link") {
      await this.sendMagicLink(email, account._id);
    } else {
      await this.sendEmailWithOtp(email, "reset code", EmailSubjectEnum.Forgot_Password);
    }
  };

  // verifyOtp
  public verifyOtp = async ({ email, otp }: { email: string; otp: string }) => {
    const payload = { email, subject: EmailSubjectEnum.Forgot_Password };

    const account = await this.userRepository.findOne({
      filter: { email, emailConfirmedAt: { $exists: true }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("Cannot find account with this email");
    }

    const storedHashedOtp = await this.redis.get(this.redis.otpKey(payload));
    if (!storedHashedOtp) {
      throw new BadRequestException("OTP has expired or is invalid");
    }

    const match = await compareHash({ plainText: `${otp}`, cipherText: storedHashedOtp as string });
    if (!match) {
      throw new BadRequestException("Invalid OTP");
    }

    account.emailVerifiedAt = new Date();
    await account.save();
    await this.redis.del(this.redis.otpKey(payload));

    return account;
  };

  // verifyMagicLink
  public verifyMagicLink = async (token: string) => {
    let payload: any;
    try {
      payload = verifyToken({ token, secretk: MAGIC_LINK_SECRET });
    } catch {
      throw new BadRequestException("Magic link is invalid or expired");
    }

    const account = await this.userRepository.findOne({
      filter: { _id: payload.userId, emailConfirmedAt: { $exists: true }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("Cannot find account");
    }

    const isRevoked = await this.redis.get(this.redis.magicLinkRevokeKey(token));
    if (isRevoked) {
      throw new BadRequestException("Magic link has already been used");
    }

    account.emailVerifiedAt = new Date();
    await account.save();

    await this.redis.set(this.redis.magicLinkRevokeKey(token), "1", 60 * 15);

    return account;
  };

  // resetPassword
  public resetPassword = async ({ email, password }: { email: string; password: string }) => {
    const otpPayload = { email, subject: EmailSubjectEnum.Forgot_Password };

    const account = await this.userRepository.findOne({
      filter: { email, emailConfirmedAt: { $exists: true }, provider: ProviderEnum.System },
    });
    if (!account) {
      throw new NotFoundException("Cannot find account with this email");
    }

    if (!account.emailVerifiedAt) {
      throw new BadRequestException("OTP not verified");
    }

    const isExpired = Date.now() - new Date(account.emailVerifiedAt).getTime() > 10 * 60 * 1000;
    if (isExpired) {
      account.emailVerifiedAt = undefined;
      await account.save();
      throw new BadRequestException("Verification expired, please request a new code");
    }

    account.password = await generateHash({ plainText: password });
    account.emailVerifiedAt = undefined;
    account.changeCredentialsTime = new Date();
    await account.save();

    await this.redis.del([
      this.redis.otpKey(otpPayload),
      this.redis.otpAttemptsKey(otpPayload),
      this.redis.otpBlockKey(otpPayload),
      this.redis.revokeTokenPrefix(account._id),
    ]);

    return account;
  };

  // Login / 2FA
  // ===========================

  // login
  public async login  (data: LoginDto, issuer: string): Promise<ILoginResponse>  {
    const { email, password } = data;

    const user = await this.userRepository.findOne({
      filter: { email, provider: ProviderEnum.System,  },
    });
    // emailConfirmedAt: { $exists: true }
    if (!user) {
      throw new UnauthorizedException("Email or Password is incorrect");
    }

    const match = await compareHash({
      plainText: password,
      cipherText: user.password as string,
      approach: HashApproachEnum.bcrypt,
    });
    if (!match) {
      throw new UnauthorizedException("Email or Password is incorrect");
    }

    // if (user.twoFactorVerified) {
    //   await this.requestTwoFactorAuth(user);
    //   return { twoFactorRequired: true };
    // }

    return this.tokenService.createLoginCredentials(user, issuer);
  };

  // loginConfirm
  public loginConfirm = async ({ email, otp }: { email: string; otp: string }, issuer: string) => {
    const user = await this.userRepository.findOne({
      filter: { email, provider: ProviderEnum.System, emailConfirmedAt: { $exists: true } },
    });
    if (!user) {
      throw new UnauthorizedException("Email or Password is incorrect");
    }
    if (!user.twoFactorVerified) {
      throw new BadRequestException("2FA is not enabled for this account");
    }

    const storedHashedOtp = await this.redis.get(this.redis.twoFaKey(user._id));
    if (!storedHashedOtp) {
      throw new BadRequestException("OTP has expired or is invalid");
    }

    const match = await compareHash({ plainText: `${otp}`, cipherText: storedHashedOtp as string });
    if (!match) {
      throw new BadRequestException("2FA code is incorrect");
    }

    await this.redis.del([
      this.redis.twoFaKey(user._id),
      this.redis.twoFaAttemptsKey(user._id),
      this.redis.twoFaBlockKey(user._id),
    ]);

    return this.tokenService.createLoginCredentials(user, issuer);
  };

  // requestTwoFactorAuth
  private requestTwoFactorAuth = async (user: any): Promise<void> => {
    const isBlocked = await this.redis.get(this.redis.twoFaBlockKey(user._id));
    if (isBlocked) {
      const remaining = await this.redis.ttl(this.redis.twoFaBlockKey(user._id));
      throw new TooManyRequestsException(
        `Too many attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
      );
    }

    const attempts = await this.redis.incr(this.redis.twoFaAttemptsKey(user._id));
    if (attempts === 1) await this.redis.expire(this.redis.twoFaAttemptsKey(user._id), this.BLOCK_TTL);

    if (attempts > this.MAX_ATTEMPTS) {
      await this.redis.set(this.redis.twoFaBlockKey(user._id), "1", this.BLOCK_TTL);
      await this.redis.del(this.redis.twoFaAttemptsKey(user._id));
      throw new TooManyRequestsException(
        `Too many attempts. Try again in ${this.BLOCK_TTL / 60} minutes.`,
      );
    }

    const code = await createOtp();
    await this.redis.set(this.redis.twoFaKey(user._id), await generateHash({ plainText: `${code}` }), 120);

    emailEmitter.emit("sendOtpEmail", {
      to: user.email,
      title: "2FA code",
      subject: "verify 2FA for your account",
      code,
    });
  };

  // enableTwoFactorAuth
  public enableTwoFactorAuth = async (user: any, { otp }: { otp: string }): Promise<void> => {
    const storedHashedOtp = await this.redis.get(this.redis.twoFaKey(user._id));
    if (!storedHashedOtp) {
      throw new BadRequestException("OTP has expired or is invalid");
    }

    const match = await compareHash({ plainText: `${otp}`, cipherText: storedHashedOtp as string });
    if (!match) {
      throw new BadRequestException("Invalid OTP");
    }

    user.twoFactorVerified = true;
    await user.save();

    await this.redis.del([
      this.redis.twoFaKey(user._id),
      this.redis.twoFaAttemptsKey(user._id),
      this.redis.twoFaBlockKey(user._id),
    ]);
  };

  // Google OAuth
  // ===========================

  // verifyGoogleToken
  private verifyGoogleToken = async (idToken: string) => {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
      throw new BadRequestException("fail to verify by google");
    }
    return payload;
  };

  // signupWithGmail
  public signupWithGmail = async (idToken: string, issuer: string) => {
    const payload = await this.verifyGoogleToken(idToken);

    const checkExist = await this.userRepository.findOne({ filter: { email: payload.email } });
    if (checkExist) {
      if (checkExist.provider !== ProviderEnum.Google) {
        throw new ConflictException("invalid provider");
      }
      return {
        message: "logged in successfully",
        status: 200,
        credentials: await this.loginWithGmail(idToken, issuer),
      };
    }

    const user = await this.userRepository.createOne({
      data: {
        firstName: payload.given_name,
        lastName: payload.family_name,
        email: payload.email,
        emailConfirmedAt: new Date(),
        provider: ProviderEnum.Google,
        profilePicture: payload.picture,
      },
    });

    return {
      message: "signed up successfully",
      status: 201,
      credentials: await this.tokenService.createLoginCredentials(user, issuer),
    };
  };

  // loginWithGmail
  public loginWithGmail = async (idToken: string, issuer: string) => {
    const payload = await this.verifyGoogleToken(idToken);
    const user = await this.userRepository.findOne({
      filter: { email: payload.email, provider: ProviderEnum.Google },
    });
    if (!user) {
      throw new NotFoundException("Not registered account");
    }
    return this.tokenService.createLoginCredentials(user, issuer);
  };
}

export default new AuthenticationService();