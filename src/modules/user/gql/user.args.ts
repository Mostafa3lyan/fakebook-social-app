import { GraphQLFieldConfigArgumentMap, GraphQLID, GraphQLNonNull } from "graphql";

export interface IShareProfileArgs {
  userId: string;
}

export const shareProfileArgs: GraphQLFieldConfigArgumentMap = {
  userId: {
    type: new GraphQLNonNull(GraphQLID),
    description: "Target user ID (24-character hex string)",
  },
};
