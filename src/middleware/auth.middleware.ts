import type { NextFunction, Request, Response } from "express";
import { TokenTypeEnum, RoleEnum } from "../common/enums";
import { ForbiddenException, UnauthorizedException } from "../common/exceptions/index";
import { IUser } from "../common/interfaces";
import { HydratedDocument } from "mongoose";
import { JwtPayload } from "jsonwebtoken";
import { TokenService } from "../common/services";

declare global {
  namespace Express {
    interface Request {
      token?: string;
      user: HydratedDocument<IUser>;
      decoded?: JwtPayload;
    }
  }
}

const BEARER_RE = /^Bearer (.+)$/;

export const authentication = (tokenType: TokenTypeEnum = TokenTypeEnum.access) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tokenService = new TokenService();

    const token = req.headers.authorization?.match(BEARER_RE)?.[1];
    if (!token) throw new UnauthorizedException("missing authentication key or Invalid token format");

    const { user, decoded } = await tokenService.decodeToken({ token, tokenType });

    req.token = token;
    req.user = user;
    req.decoded = decoded;
    next();
  };
};

export const authorization = (accessRole: RoleEnum[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedException("Authentication required");
    if (!accessRole.includes(req.user.role)) throw new ForbiddenException("Not authorized account");
    next();
  };
};