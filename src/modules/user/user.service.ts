import { LogoutEnum, RoleEnum } from "../../common/enums";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../../config/config.service";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "../../common/exceptions/index";
import {
  compareHash,
  decryptGenerator,
  generateHash,
} from "../../common/utils/security/index";
import { RedisService, redisService } from "../../common/services/redis.service";
import { TokenService } from "../../common/services/token.service";
import { UserRepository } from "./../../DB/repository/user.repository";
import { HydratedDocument } from "mongoose";
import { IUser } from "../../common/interfaces";
import { decodedTypes } from "../../common/types/user.types";

class UserService {
  private readonly userRepository: UserRepository;
  private readonly redis: RedisService;
  private readonly tokenService: TokenService;

  constructor() {
    this.userRepository = new UserRepository();
    this.tokenService = new TokenService();
    this.redis = redisService;
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
  public profileImage = async (file: any, user: HydratedDocument<IUser>) => {
    user.profilePicture = file.finalPath;
    await user.save();
    return user;
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
    const match = await compareHash({
      plainText: oldPassword,
      cipherText: user.password as string,
    });

    if (!match) {
      throw new BadRequestException("Old password is incorrect");
    }

    for (const hash of user.oldPasswords || []) {
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

    user.oldPasswords = user.oldPasswords || [];
    user.oldPasswords.push(user.password);
    user.password = await generateHash({ plainText: newPassword });
    user.changeCredentialsTime = new Date();
    await user.save();

    await this.redis.del(await this.redis.keys(this.redis.revokeTokenPrefix(user._id)));
    return this.tokenService.createLoginCredentials(user, issuer);
  };
}

export default new UserService();