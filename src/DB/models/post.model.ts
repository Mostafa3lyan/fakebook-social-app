import { Model, model, Schema } from "mongoose";
import { PostVisibility, ReactionType } from "../../common/enums/index";
import { IPost, IReaction, IComment, ISharedPost } from "../../common/interfaces/index";

const ReactionSchema = new Schema<IReaction>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: Object.values(ReactionType),
      required: true,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const CommentSchema = new Schema<IComment>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true },
    reactions: { type: [ReactionSchema], default: [] },
    replies: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);

const SharedPostSchema = new Schema<ISharedPost>(
  {
    originalPostId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    originalAuthorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false },
);

const postSchema = new Schema<IPost, Model<IPost>>(
  {
    folderId: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 63206,
      required: function (this: IPost) {
        return !this.attachments || this.attachments.length === 0;
      }
    },
    attachments: {
      type: [String],
      default: [],
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    visibility: {
      type: String,
      enum: Object.values(PostVisibility),
      default: PostVisibility.PUBLIC,
    },
    taggedUserIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },

    location: {
      name: { type: String },
      lat: { type: Number },
      lng: { type: Number },
    },

    reactions: { type: [ReactionSchema], default: [] },
    comments: { type: [CommentSchema], default: [] },
    sharedFrom: { type: SharedPostSchema },
    shareCount: { type: Number, default: 0, min: 0 },
    isEdited: { type: Boolean, default: false },

    deletedAt: { type: Date },
    restoredAt: { type: Date },
  },
  {
    timestamps: true,
    strict: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
    strictQuery: true,
  },
);

// Feed queries: latest posts per folder, newest first
postSchema.index({ folderId: 1, createdAt: -1 });
// Profile/author queries
postSchema.index({ createdBy: 1, createdAt: -1 });
// Sparse: only soft deleted docs are indexed, which is all the trash/restore
// queries below ever look for.
postSchema.index({ deletedAt: 1 }, { sparse: true });

type PostUpdate = Partial<IPost> & {
  $set?: Partial<IPost>;
  $unset?: Record<string, unknown>;
};

const readUpdate = (update: unknown): PostUpdate => {
  if (!update || Array.isArray(update)) return {}; // aggregation pipeline update
  const u = update as PostUpdate;
  return { ...u, ...u.$set };
};

// Prevent reading soft deleted posts. Opt out with `paranoid: false` in the filter.
postSchema.pre(["find", "findOne", "countDocuments"], function () {
  const { paranoid, ...query } = this.getQuery();

  this.setQuery(paranoid === false ? query : { ...query, deletedAt: { $exists: false } });
});

// Handle soft delete and restore operations
postSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function () {
  const update = this.getUpdate() as PostUpdate | null;
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
// `deleteOne({ _id })` on a live post matches nothing instead of destroying it.
// Pass `force: true` in the filter to delete regardless of state.
postSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function () {
  const { force, ...query } = this.getQuery();

  this.setQuery(force === true ? query : { ...query, deletedAt: { $exists: true } });
});

export const PostModel: Model<IPost> = model<IPost>("Post", postSchema);