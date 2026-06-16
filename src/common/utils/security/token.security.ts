import jwt from "jsonwebtoken";
import { randomUUID } from 'node:crypto';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_SECRET_KEY,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET_KEY,
  SYSTEM_ACCESS_TOKEN_SECRET_KEY,
  SYSTEM_REFRESH_TOKEN_SECRET_KEY,
} from "../../../../config/config.service.js";
import { findOne } from "../../../DB/db.repository.js";
import { UserModel } from "../../../DB/index.js";
import { TokenTypeEnum } from "../../enums/security.enum.js";
import { RoleEnum } from "../../enums/user.enum.js";
import { get, revokeTokenKey } from "../../services/redis.service.js";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "../response/error.response.js";

export class TokenService {
  generateToken({
    payload = {},
    secretKey = ACCESS_TOKEN_SECRET_KEY,
    options = {},
  }: {
    payload?: any;
    secretKey?: string;
    options?: jwt.SignOptions;
  }) {
    return jwt.sign(payload, secretKey, options);
  }

  verifyToken({
    token,
    secretKey = ACCESS_TOKEN_SECRET_KEY,
  }: {
    token: string;
    secretKey?: string;
  }) {
    return jwt.verify(token, secretKey);
  }

  detectSignature(level: RoleEnum) {
    let signatures = { accessSignature: ACCESS_TOKEN_SECRET_KEY, refreshSignature: REFRESH_TOKEN_SECRET_KEY };

    switch (level) {
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

  getSignature({
    tokenType = TokenTypeEnum.access,
    level,
  }: {
    tokenType?: TokenTypeEnum;
    level: RoleEnum;
  }) {
    const { accessSignature, refreshSignature } = this.detectSignature(level);
    let signature = undefined;

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
  }) {
    const decoded = jwt.decode(token) as any;  

    if (!decoded?.aud?.length) {
      throw BadRequestException({ message: "Missing token audience" });
    }

    const [tokenApproach, level] = decoded.aud || [];
    if (tokenType !== tokenApproach) {
      throw ConflictException({
        message: `invalid token signature we expected ${tokenType} but got ${tokenApproach}`,
      });
    }

    if (decoded.jti && await get(revokeTokenKey({ userId: decoded.sub, jti: decoded.jti }))) {
      throw UnauthorizedException({ message: "Invalid login session" });
    }

    const secretKey = this.getSignature({ tokenType: tokenApproach, level });

    const verifiedData = this.verifyToken({
      token,
      secretKey,
    }) as any;

    const user = await findOne({
      model: UserModel,
      filter: { _id: verifiedData.sub },
    });

    if (!user) {
      throw NotFoundException({ message: "No registered account" });
    }

    if (user.changeCredentialsTime && user.changeCredentialsTime.getTime() >= decoded.iat * 1000) {
      throw UnauthorizedException({ message: "Invalid login session" });
    }

    return { user, decoded };
  }

  createLoginCredentials(user: any, issuer: string) {
    const payload = { sub: user._id.toString() };
    const { accessSignature, refreshSignature } = this.detectSignature(
      user.role,
    );

    const jwtid = randomUUID();
    const access_token = this.generateToken({
      payload,
      secretKey: accessSignature,
      options: {
        issuer,
        audience: [TokenTypeEnum.access.toString(), user.role.toString()],
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        jwtid,
      },
    });

    const refresh_token = this.generateToken({
      payload,
      secretKey: refreshSignature,
      options: {
        issuer,
        audience: [TokenTypeEnum.refresh.toString(), user.role.toString()],
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        jwtid,
      },
    });

    return { access_token, refresh_token };
  }
}

export const tokenService = new TokenService();
export const generateToken = tokenService.generateToken.bind(tokenService);
export const verifyToken = tokenService.verifyToken.bind(tokenService);
export const detectSignature = tokenService.detectSignature.bind(tokenService);
export const getSignature = tokenService.getSignature.bind(tokenService);
export const decodeToken = tokenService.decodeToken.bind(tokenService);
export const createLoginCredentials = tokenService.createLoginCredentials.bind(tokenService);
