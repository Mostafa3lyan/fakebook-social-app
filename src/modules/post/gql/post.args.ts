import {
  GraphQLFieldConfigArgumentMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
} from "graphql";
import { ReactionTypeEnum } from "../../../common/enums";
import { ReactionTypeEnumType } from "./post.types";

export interface IGetPostByIdArgs {
  postId: string;
}

export const getPostByIdArgs: GraphQLFieldConfigArgumentMap = {
  postId: {
    type: new GraphQLNonNull(GraphQLID),
    description: "Post ID (24-character hex string)",
  },
};

export interface IGetPostsArgs {
  page?: number;
  limit?: number;
  search?: string;
}

export const getPostsArgs: GraphQLFieldConfigArgumentMap = {
  page: {
    type: GraphQLInt,
    description: "Page number",
  },
  limit: {
    type: GraphQLInt,
    description: "Page limit",
  },
  search: {
    type: GraphQLString,
    description: "Search keyword matching post content",
  },
};

export interface IReactAtPostArgs {
  postId: string;
  reaction: ReactionTypeEnum;
}

export const reactAtPostArgs: GraphQLFieldConfigArgumentMap = {
  postId: {
    type: new GraphQLNonNull(GraphQLID),
    description: "Target post ID to react to",
  },
  reaction: {
    type: new GraphQLNonNull(ReactionTypeEnumType),
    description: "Reaction type (like, love, care, haha, wow, sad, angry)",
  },
};
