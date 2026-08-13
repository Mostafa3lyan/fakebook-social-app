import { Model, model, Schema } from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../common/enums/index";
import { IUser } from "../../common/interfaces/index";



const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 25,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === ProviderEnum.System;
      },
    },
    phone: { type: String },
    dateOfBirth: { type: Date },
    emailConfirmedAt: { type: Date },
    emailVerifiedAt: { type: Date },
    changeCredentialsTime: { type: Date },
    profilePicture: { type: String },
    profileCoverPictures: { type: [String], default: [] },
    oldPasswords: { type: [String], default: [] },

    profileVisits: {
      type: Number,
      default: 0,
    },
    gender: {
      type: String,
      enum: Object.values(GenderEnum),
      default: GenderEnum.Male,
    },
    provider: {
      type: String,
      enum: Object.values(ProviderEnum),
      default: ProviderEnum.System,
    },
    role: {
      type: String,
      enum: Object.values(RoleEnum),
      default: RoleEnum.User,
    },
    twoFactorVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema
  .virtual("fullName")
  .get(function (this: IUser) {
    return `${this.firstName} ${this.lastName}`;
  })
  .set(function (this: IUser, value: string) {
    const [firstName = "", lastName = ""] = value.split(" ");
    this.firstName = firstName;
    this.lastName = lastName;
  });

export const UserModel: Model<IUser> = model<IUser>("User", userSchema);