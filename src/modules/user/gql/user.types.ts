import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../../common/enums";
import { HydratedDocument } from "mongoose";
import { IUser } from "../../../common/interfaces";

export const GenderEnumType = new GraphQLEnumType({
  name: "GenderEnum",
  values: {
    MALE: { value: GenderEnum.Male },
    FEMALE: { value: GenderEnum.Female },
  },
});

export const RoleEnumType = new GraphQLEnumType({
  name: "RoleEnum",
  values: {
    USER: { value: RoleEnum.User },
    ADMIN: { value: RoleEnum.Admin },
  },
});

export const ProviderEnumType = new GraphQLEnumType({
  name: "ProviderEnum",
  values: {
    SYSTEM: { value: ProviderEnum.System },
    GOOGLE: { value: ProviderEnum.Google },
  },
});

export const UserType: GraphQLObjectType = new GraphQLObjectType({
  name: "User",
  description: "User profile object type",
  fields: () => ({
    _id: { type: new GraphQLNonNull(GraphQLID) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    fullName: {
      type: GraphQLString,
      resolve: (user: HydratedDocument<IUser>) => `${user.firstName} ${user.lastName}`,
    },

    email: { type: GraphQLString },
    phone: { type: GraphQLString },
    gender: { type: GenderEnumType },
    role: { type: RoleEnumType },
    provider: { type: ProviderEnumType },
    profilePicture: { type: GraphQLString },
    profileCoverPictures: { type: new GraphQLList(GraphQLString) },
    profileVisits: { type: GraphQLInt },
    twoFactorVerified: { type: GraphQLBoolean },

    dateOfBirth: { type: GraphQLString },
    emailConfirmedAt: { type: GraphQLString },
    changeCredentialsTime: { type: GraphQLString },
    resetVerifiedAt: { type: GraphQLString },
    deletedAt: { type: GraphQLString },
    restoredAt: { type: GraphQLString },

    friends: {
      type: new GraphQLList(UserType),
    },


    createdAt: { type: GraphQLString },
    updatedAt: { type: GraphQLString },
  }),
});

export const PublicUserType = new GraphQLObjectType({
  name: "PublicUser",
  fields: () => ({
    _id: { type: new GraphQLNonNull(GraphQLID) },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    fullName: {
      type: GraphQLString,
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    },
    profilePicture: { type: GraphQLString },
  }),
});
