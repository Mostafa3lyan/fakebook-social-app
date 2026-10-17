import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { userQueries, userMutations } from "../user";
import { postQueries, postMutations } from "../post";

const query = new GraphQLObjectType({
  name: "RootSchemaQuery",
  description: "Root query for Fakebook GraphQL API",
  fields: {
    welcome: {
      type: GraphQLString,
      description: "Healthcheck query",
      resolve: () => "Welcome to Fakebook GraphQL API",
    },
    ...userQueries,
    ...postQueries,
  },
});

const mutation = new GraphQLObjectType({
  name: "RootSchemaMutation",
  description: "Root mutation for Fakebook GraphQL API",
  fields: {
    welcome: {
      type: GraphQLString,
      description: "Healthcheck mutation",
      resolve: () => "Welcome to Fakebook GraphQL Mutations",
    },
    ...userMutations,
    ...postMutations,
  },
});

export const schema = new GraphQLSchema({ query, mutation });