import type { HydratedDocument } from "mongoose";
import { UnauthorizedException, ForbiddenException, mapGraphQLError, ApplicationException } from "../../../common/exceptions";
import type { IUser } from "../../../common/interfaces";
import { RoleEnum } from "../../../common/enums";
import type { GraphQLContext } from "../context";

export const gqlAuthentication = (context: GraphQLContext): HydratedDocument<IUser> => {
  // Case 1: Token was provided, but verification failed (expired, invalid signature, revoked, etc.)
  if (context.authError) {
    throw mapGraphQLError(context.authError as ApplicationException);
  }
  // Case 2: No authorization header or token was provided at all
  if (!context.user) {
    throw mapGraphQLError(new UnauthorizedException("Authentication token is required"));
  }
  return context.user;
};


export const gqlAuthorization = (
  context: GraphQLContext,
  roles: RoleEnum[] = [RoleEnum.User]
): HydratedDocument<IUser> => {
  const user = gqlAuthentication(context);
  if (!roles.includes(user.role)) {
    throw mapGraphQLError(new ForbiddenException("Not authorized account"));
  }
  return user;
};
