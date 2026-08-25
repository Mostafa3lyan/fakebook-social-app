import { Model, model, Schema } from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../common/enums/index";
import { IUser, IUserVirtuals } from "../../common/interfaces/index";
import { encryptGenerator, generateHash } from "../../common/utils";



const userSchema = new Schema<IUser, Model<IUser>, {}, {}, IUserVirtuals>(
  {
    firstName: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 50,
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
      select: false,
      required: function (this: IUser) {
        return this.provider === ProviderEnum.System;
      },
    },
    // Stored encrypted (`iv:cipherText`), so no length limits here — they would
    // measure the cipher text, not the number. Format is enforced by the zod
    // `phone` field at the request layer.
    phone: { type: String },
    dateOfBirth: { type: Date },
    emailConfirmedAt: { type: Date },
    resetVerifiedAt: { type: Date },
    changeCredentialsTime: { type: Date },
    deletedAt: { type: Date },
    restoredAt: { type: Date },
    profilePicture: { type: String },
    profileCoverPictures: { type: [String], default: [] },
    oldPasswords: { type: [String], default: [], select: false },

    profileVisits: {
      type: Number,
      default: 0,
      min: 0,
    },
    gender: {
      type: String,
      enum: Object.values(GenderEnum),
      required: function (this: IUser) {
        return this.provider === ProviderEnum.System;
      },
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
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.oldPasswords;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
    strictQuery: true,
  },
);

// Sparse: only soft deleted docs are indexed, which is all the trash/restore
// queries below ever look for.
userSchema.index({ deletedAt: 1 }, { sparse: true });

// Define a virtual property for full name
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


type UserUpdate = Partial<IUser> & {
  $set?: Partial<IUser>;
  $unset?: Record<string, unknown>;
};

/**
 * Callers write updates either flat (`{ password }`) or wrapped (`{ $set: { password } }`).
 * Reading only the flat form silently lets `$set` payloads skip the hooks below —
 * which would store a plaintext password. Always read through this.
 */
const readUpdate = (update: unknown): UserUpdate => {
  if (!update || Array.isArray(update)) return {}; // aggregation pipeline update
  const u = update as UserUpdate;
  return { ...u, ...u.$set };
};

/** Write a value back to whichever form the caller used, so nothing is duplicated. */
const writeUpdate = (
  update: UserUpdate,
  field: "password" | "phone",
  value: string,
): void => {
  if (update.$set && field in update.$set) update.$set[field] = value;
  else update[field] = value;
};

// Encrypt phone number and hash password before saving the user document
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await generateHash({ plainText: this.password as string });
  }
  if (this.phone && this.isModified("phone")) {
    this.phone = encryptGenerator({ plainText: this.phone });
  }
});

// Encrypt phone number and hash password before updating the user document
userSchema.pre(
  ["findOneAndUpdate", "updateOne", "updateMany"],
  async function () {
    const update = this.getUpdate() as UserUpdate | null;
    if (!update || Array.isArray(update)) return;

    const fields = readUpdate(update);
    if (fields.password) {
      writeUpdate(update, "password", await generateHash({ plainText: fields.password }));
    }
    if (fields.phone) {
      writeUpdate(update, "phone", encryptGenerator({ plainText: fields.phone }));
    }
    this.setUpdate(update);
  },
);

// Prevent reading soft deleted users. Opt out with `paranoid: false` in the filter.
userSchema.pre(["find", "findOne", "countDocuments"], function () {
  const { paranoid, ...query } = this.getQuery();

  this.setQuery(paranoid === false ? query : { ...query, deletedAt: { $exists: false } });
});

// Handle soft delete and restore operations
userSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
  const update = this.getUpdate() as UserUpdate | null;
  const fields = readUpdate(update);
  const { paranoid, ...query } = this.getQuery();

  if (fields.restoredAt) {
    this.setUpdate({ ...update, $unset: { ...update?.$unset, deletedAt: 1 } });
    // A restore targets soft deleted docs only — it must skip the guard below.
    this.setQuery({ ...query, deletedAt: { $exists: true } });
    return;
  }

  if (fields.deletedAt) {
    this.setUpdate({ ...update, $unset: { ...update?.$unset, restoredAt: 1 } });
  }

  this.setQuery(paranoid === false ? query : { ...query, deletedAt: { $exists: false } });
});

// Hard delete only purges what is already in the trash, so an accidental
// `deleteOne({ _id })` on a live account matches nothing instead of destroying it.
// Pass `force: true` in the filter to delete regardless of state.
userSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function () {
  const { force, ...query } = this.getQuery();

  this.setQuery(force === true ? query : { ...query, deletedAt: { $exists: true } });
});

export const UserModel: Model<IUser> = model<IUser>("User", userSchema);