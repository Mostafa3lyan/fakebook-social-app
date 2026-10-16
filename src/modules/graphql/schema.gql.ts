import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { userQueries } from "../user";

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
  },
});

export const schema = new GraphQLSchema({ query, mutation });