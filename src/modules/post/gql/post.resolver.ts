import type { GraphQLFieldConfig } from "graphql";
import { HydratedDocument } from "mongoose";
import { IUser } from "../../../common/interfaces";
import { paginationValidationSchema } from "../../../common/validation";
import { gqlValidation } from "../../../middleware";
import type { GraphQLContext } from "../../graphql/context";
import { gqlAuthentication } from "../../graphql/guards/auth.guard";
import { postService } from "../post.service";
import { postIdParamSchema, reactAtPostSchema } from "../post.validation";
import {
  getPostByIdArgs,
  getPostsArgs,
  reactAtPostArgs,
  type IGetPostByIdArgs,
  type IGetPostsArgs,
  type IReactAtPostArgs,
} from "./post.args";
import { PaginatedPostsType, PostType } from "./post.types";

export const postsQuery: GraphQLFieldConfig<unknown, GraphQLContext, IGetPostsArgs> = {
  type: PaginatedPostsType,
  description: "Get feed of posts visible to the authenticated user",
  args: getPostsArgs,
  resolve: async (_source, args, context) => {
    gqlAuthentication(context);
    const dto = gqlValidation(paginationValidationSchema.query, args);
    return await postService.getPosts(dto, context.user as HydratedDocument<IUser>);
  },
};

export const postQuery: GraphQLFieldConfig<unknown, GraphQLContext, IGetPostByIdArgs> = {
  type: PostType,
  description: "Get single post by ID if accessible to the authenticated user",
  args: getPostByIdArgs,
  resolve: async (_source, args, context) => {
    gqlAuthentication(context);
    const dto = gqlValidation(postIdParamSchema, { postId: args.postId });
    return await postService.getPostById(dto, context.user as HydratedDocument<IUser>);
  },
};

export const reactAtPostMutation: GraphQLFieldConfig<unknown, GraphQLContext, IReactAtPostArgs> = {
  type: PostType,
  description: "React to a post, change existing reaction, or toggle off",
  args: reactAtPostArgs,
  resolve: async (_source, args, context) => {
    gqlAuthentication(context);
    const paramDto = gqlValidation(postIdParamSchema, { postId: args.postId });
    const bodyDto = gqlValidation(reactAtPostSchema.body, { reaction: args.reaction });
    return await postService.reactAtPost(bodyDto, paramDto, context.user as HydratedDocument<IUser>);
  },
};

export const postQueries = {
  posts: postsQuery,
  post: postQuery,
};

export const postMutations = {
  reactAtPost: reactAtPostMutation,
};
