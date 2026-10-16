import type { Request as ExpressRequest, Response as ExpressResponse } from "express";
import type { Request as GraphQLHttpRequest, OperationContext } from "graphql-http";
import type { RequestContext } from "graphql-http/lib/use/express";
import type { JwtPayload } from "jsonwebtoken";
import type { HydratedDocument } from "mongoose";
import { TokenTypeEnum } from "../../common/enums";
import type { IUser } from "../../common/interfaces";
import { TokenService } from "../../common/services";

export type GraphQLContext = OperationContext & {
  req: ExpressRequest;
  res?: ExpressResponse | undefined;
  user?: HydratedDocument<IUser> | undefined;
  decoded?: JwtPayload | undefined;
  authError?: Error | undefined;
  [key: PropertyKey]: unknown;
};

const tokenService = new TokenService();

export const graphQLContext = async (
  req: GraphQLHttpRequest<ExpressRequest, RequestContext>
): Promise<GraphQLContext> => {
  let user: HydratedDocument<IUser> | undefined = undefined;
  let decoded: JwtPayload | undefined = undefined;
  let authError: Error | undefined = undefined;

  const rawReq = req.raw;
  const authHeader = rawReq.headers?.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      try {
        const decodedToken = await tokenService.decodeToken({
          token,
          tokenType: TokenTypeEnum.access,
        });
        user = decodedToken.user;
        decoded = decodedToken.decoded;
      } catch (error) {
        authError = error as Error;
      }
    }
  }

  return {
    req: rawReq,
    res: req.context?.res,
    user,
    decoded,
    authError,
  };
};
