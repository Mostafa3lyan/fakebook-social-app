import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { randomUUID } from "crypto";
import {
  ACCESS_TOKEN_SECRET_KEY,
  REFRESH_TOKEN_SECRET_KEY,
  SYSTEM_ACCESS_TOKEN_SECRET_KEY,
  SYSTEM_REFRESH_TOKEN_SECRET_KEY,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "../../config/config.service";
import { RoleEnum, TokenTypeEnum } from "../enums";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "../exceptions/index";
import { RedisService, redisService } from "../services/redis.service";
import { UserRepository } from "./../../DB/repository/user.repository";
import { HydratedDocument, Types } from "mongoose";
import { IUser } from "../interfaces";

export type signatureType = {
  accessSignature: string;
  refreshSignature: string;
};

export class TokenService {
  private readonly Redis: RedisService = redisService;
  private readonly UserRepository: UserRepository;

  constructor() {
    this.UserRepository = new UserRepository();
  }

  generateToken({
    payload,
    secretKey = ACCESS_TOKEN_SECRET_KEY,
    options,
  }: {
    payload: object;
    secretKey?: string;
    options?: SignOptions;
  }): string {
    return jwt.sign(payload, secretKey, options);
  }

  verifyToken({
    token,
    secretKey = ACCESS_TOKEN_SECRET_KEY,
  }: {
    token: string;
    secretKey?: string;
  }): JwtPayload {
    try {
      return jwt.verify(token, secretKey) as JwtPayload;
    } catch (error) {
      // jsonwebtoken throws plain Errors, which the global handler would turn
      // into a 500. An expired or forged token is a 401, not a server fault.
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException("Token expired");
      }
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.NotBeforeError
      ) {
        throw new UnauthorizedException("Invalid token");
      }
      throw error;
    }
  }

  async detectSignature(signatureRole: RoleEnum): Promise<signatureType> {
    let signatures: signatureType;

    switch (signatureRole) {
      case RoleEnum.Admin:
        signatures = {
          accessSignature: SYSTEM_ACCESS_TOKEN_SECRET_KEY,
          refreshSignature: SYSTEM_REFRESH_TOKEN_SECRET_KEY,
        };
        break;

      default:
        signatures = {
          accessSignature: ACCESS_TOKEN_SECRET_KEY,
          refreshSignature: REFRESH_TOKEN_SECRET_KEY,
        };
        break;
    }
    return signatures;
  }

  async getSignature({
    tokenType = TokenTypeEnum.access,
    signatureRole,
  }: {
    tokenType?: TokenTypeEnum;
    signatureRole: RoleEnum;
  }): Promise<string> {
    const { accessSignature, refreshSignature } = await this.detectSignature(signatureRole);
    let signature: string;

    switch (tokenType) {
      case TokenTypeEnum.refresh:
        signature = refreshSignature;
        break;
      default:
        signature = accessSignature;
        break;
    }
    return signature;
  }

  async decodeToken({
    token,
    tokenType = TokenTypeEnum.access,
  }: {
    token: string;
    tokenType?: TokenTypeEnum;
  }): Promise<{ user: HydratedDocument<IUser>; decoded: JwtPayload }> {

    const decoded = jwt.decode(token) as JwtPayload;

    if (!decoded?.aud?.length) {
      throw new BadRequestException("Missing token audience");
    }

    const [tokenApproach, signatureRole] = decoded.aud || [];
    if (tokenApproach === undefined || signatureRole === undefined) {
      throw new BadRequestException("Missing token audience");
    }

    if (tokenType !== tokenApproach as unknown as TokenTypeEnum) {
      throw new ConflictException(
        `invalid token signature we expected ${tokenType} but got ${tokenApproach}`,
      );
    }

    if (
      decoded.jti &&
      (await this.Redis.get(
        this.Redis.revokeTokenKey({ userId: decoded?.sub as string, jti: decoded.jti }),
      ))
    ) {
      throw new UnauthorizedException("Invalid login session please try to login again");
    }

    const secretKey = await this.getSignature({
      tokenType: tokenApproach as unknown as TokenTypeEnum,
      signatureRole: signatureRole as unknown as RoleEnum,
    });

    const verifiedData = this.verifyToken({
      token,
      secretKey,
    });

    const user = await this.UserRepository.findOne({
      filter: { _id: verifiedData.sub },
    });

    if (!user) {
      throw new NotFoundException("No registered account");
    }

    const iat = verifiedData.iat;
    if (typeof iat !== "number") {
      throw new UnauthorizedException("Invalid login session");
    }

    if (
      user.changeCredentialsTime &&
      Math.floor(user.changeCredentialsTime.getTime() / 1000) > iat
    ) {
      throw new UnauthorizedException("Invalid login session");
    }

    return { user, decoded: verifiedData };
  }

  async createLoginCredentials(user: HydratedDocument<IUser>, issuer: string): Promise<{ access_token: string; refresh_token: string }> {
    const payload = { sub: user._id };
    const { accessSignature, refreshSignature } = await this.detectSignature(user.role);

    const jwtid = randomUUID();
    const access_token = this.generateToken({
      payload,
      secretKey: accessSignature,
      options: {
        issuer,
        audience: [TokenTypeEnum.access as unknown as string, user.role],
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        jwtid,
      },
    });

    const refresh_token = this.generateToken({
      payload,
      secretKey: refreshSignature,
      options: {
        issuer,
        audience: [TokenTypeEnum.refresh as unknown as string, user.role],
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        jwtid,
      },
    });

    return { access_token, refresh_token };
  }

  // create revoke token
  async createRevokeToken({
    userId,
    jti,
    ttl,
  }: {
    userId: Types.ObjectId | string;
    jti: string;
    ttl: number;
  }): Promise<void> {
    await this.Redis.set(this.Redis.revokeTokenKey({ userId, jti }), jti, ttl);
    return;
  };

}