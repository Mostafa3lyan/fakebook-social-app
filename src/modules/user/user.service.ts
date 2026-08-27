import { HydratedDocument } from "mongoose";
import { LogoutEnum, RoleEnum } from "../../common/enums";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "../../common/exceptions/index";
import { IUser } from "../../common/interfaces";
import { RedisService, redisService } from "../../common/services/redis.service";
import { TokenService } from "../../common/services/token.service";
import { decodedTypes } from "../../common/types/user.types";
import {
  compareHash,
  decryptGenerator,
} from "../../common/utils/security/index";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../../config/config.service";
import { UserRepository } from "./../../DB/repository/user.repository";
import { s3Service, S3Service } from "../../common/services";

class UserService {
  private readonly userRepository: UserRepository;
  private readonly redis: RedisService;
  private readonly tokenService: TokenService;
  private readonly s3: S3Service;

  constructor() {
    this.userRepository = new UserRepository();
    this.tokenService = new TokenService();
    this.redis = redisService;
    this.s3 = s3Service;
  }


  // get user profile
  public profile = async (user: HydratedDocument<IUser>) => {
    return user.toJSON();
  };

  // logout
  public logout = async (
    { flag }: { flag: LogoutEnum },
    user: HydratedDocument<IUser>,
    { jti, iat, sub }: decodedTypes,
  ): Promise<number> => {
    let status = 200;
    switch (flag) {
      case LogoutEnum.all:
        user.changeCredentialsTime = new Date();
        await user.save();
        await this.redis.del(await this.redis.scanKeys(this.redis.revokeTokenPrefix(sub)));
        break;

      default: {
        const ttl = Math.max(
          iat + REFRESH_TOKEN_EXPIRES_IN - Math.floor(Date.now() / 1000),
          0,
        );
        await this.tokenService.createRevokeToken({
          userId: sub,
          jti,
          ttl,
        });

        status = 201;
        break;
      }
    }
    return status;
  };

  // rotate token
  public rotateToken = async (
    user: HydratedDocument<IUser>,
    { sub, jti, iat }: decodedTypes,
    issuer: string,
  ) => {
    if ((iat + ACCESS_TOKEN_EXPIRES_IN) * 1000 > Date.now() + 30000) {
      throw new ConflictException("Current Access token still valid");
    }

    const ttl = Math.max(
      iat + REFRESH_TOKEN_EXPIRES_IN - Math.floor(Date.now() / 1000),
      0,
    );

    await this.tokenService.createRevokeToken({
      userId: sub,
      jti,
      ttl,
    });

    return this.tokenService.createLoginCredentials(user, issuer);
  };

  // share profile
  public shareProfile = async (userId: string, loggedInUser: HydratedDocument<IUser>) => {
    const account = await this.userRepository.findOne({
      filter: { _id: userId },
      projection: "firstName lastName email profilePicture profileVisits phone",
    });

    if (!account) {
      throw new NotFoundException("profile not found");
    }

    if (account.phone) {
      account.phone = await decryptGenerator({ encryptedText: account.phone });
    }

    await this.userRepository.updateOne({
      filter: { _id: userId },
      update: { $inc: { profileVisits: 1 } },
    });

    const isAdmin = loggedInUser?.role === RoleEnum.Admin;

    if (!isAdmin) {
      account.profileVisits = undefined;
    }

    return account;
  };

  // upload profile image
  public profileImage = async ({ contentType, originalname }: { contentType: string, originalname: string }, user: HydratedDocument<IUser>) => {
    const oldPicture = user.profilePicture;
    const { url, key } = await this.s3.createPreSignedUrl({
      path: `users/${user._id.toString()}/profile`,
      contentType,
      originalname,
    });
    if (oldPicture) {
      await this.s3.deleteAsset({ key: oldPicture });
    }
    user.profilePicture = key;
    await user.save();
    return { user, url };
  };

  // remove profile image
  public removeProfileImage = async (user: HydratedDocument<IUser>) => {
    if (!user.profilePicture) {
      throw new NotFoundException("There is no profile picture to remove");
    }
    user.profilePicture = undefined;
    await user.save();
    return user;
  };

  // upload cover image
  public profileCoverImage = async (files: any[], user: HydratedDocument<IUser>) => {
    user.profileCoverPictures = files.map((file) => file.finalPath);
    await user.save();
    return user;
  };

  // change password
  public changePassword = async (
    { oldPassword, newPassword }: { oldPassword: string; newPassword: string },
    user: HydratedDocument<IUser>,
    issuer: string,
  ) => {
    const account = await this.userRepository.findOne({
      filter: { _id: user._id },
      projection: "+password +oldPasswords",
    });

    if (!account) {
      throw new NotFoundException("Account not found");
    }

    const match = await compareHash({
      plainText: oldPassword,
      cipherText: account.password as string,
    });

    if (!match) {
      throw new BadRequestException("Old password is incorrect");
    }

    for (const hash of account.oldPasswords || []) {
      const isMatch = await compareHash({
        plainText: newPassword,
        cipherText: hash,
      });
      if (isMatch) {
        throw new BadRequestException(
          "New password cannot be the same as any of the previous passwords",
        );
      }
    }

    account.oldPasswords = account.oldPasswords || [];
    account.oldPasswords.push(account.password as string);
    account.password = newPassword;
    account.changeCredentialsTime = new Date();
    await account.save();

    await this.redis.del(await this.redis.keys(this.redis.revokeTokenPrefix(user._id)));
    return this.tokenService.createLoginCredentials(user, issuer);
  };
}

export default new UserService();