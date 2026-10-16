import type { GraphQLFieldConfig } from "graphql";
import { HydratedDocument } from "mongoose";
import { IUser } from "../../../common/interfaces";
import { gqlValidation } from "../../../middleware";
import type { GraphQLContext } from "../../graphql/context";
import { gqlAuthentication } from "../../graphql/guards/auth.guard";
import { userService } from "../user.service";
import { shareProfile, ShareProfileDto } from "../user.validation";
import { shareProfileArgs, type IShareProfileArgs } from "./user.args";
import { UserType } from "./user.types";

export const profileQuery: GraphQLFieldConfig<unknown, GraphQLContext> = {
  type: UserType,
  description: "Get current authenticated user profile",
  resolve: async (_source, _args, context) => {
    gqlAuthentication(context);
    return await userService.profile(context.user as HydratedDocument<IUser>);
  },
};

export const shareProfileQuery: GraphQLFieldConfig<unknown, GraphQLContext, IShareProfileArgs> = {
  type: UserType,
  description: "Get another user's public profile and increment visit count",
  args: shareProfileArgs,
  resolve: async (_source, args, context) => {
    const dto: ShareProfileDto = gqlValidation(shareProfile.params, { userId: args.userId });
    return await userService.shareProfile(dto, context.user as HydratedDocument<IUser>);
  },
};

export const userQueries = {
  profile: profileQuery,
  shareProfile: shareProfileQuery,
};

export const userMutations = {};
