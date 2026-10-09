import { Model, model, Schema } from "mongoose";
import { IComment } from "../../common/interfaces/index";
import { ReactionSchema } from "./post.model";

const commentSchema = new Schema<IComment, Model<IComment>>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    // parent comment — set only for replies
    commentId: { type: Schema.Types.ObjectId, ref: "Comment" },

    content: {
      type: String,
      trim: true,
      maxlength: 8000,
      required: function (this: IComment) {
        return !this.attachments || this.attachments.length === 0;
      },
    },
    attachments: { type: [String], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    tags: { type: [Schema.Types.ObjectId], ref: "User", default: [] },

    reactions: { type: [ReactionSchema], default: [] },
    reactionsCount: { type: Number, default: 0, min: 0 },
    reactionsBreakdown: { type: Schema.Types.Mixed, of: Number, default: {} },

    repliesCount: { type: Number, default: 0, min: 0 },
    isEdited: { type: Boolean, default: false },
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

// Comments of a post / replies of a comment, newest first
commentSchema.index({ postId: 1, commentId: 1, createdAt: -1 });
commentSchema.index({ createdBy: 1, createdAt: -1 });

export const CommentModel: Model<IComment> = model<IComment>("Comment", commentSchema);
