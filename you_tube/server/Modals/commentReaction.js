import mongoose from "mongoose";

const commentReactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      required: true,
    },

    type: {
      type: String,
      enum: ["like", "dislike"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// One user can have only one reaction per comment
commentReactionSchema.index(
  { userId: 1, commentId: 1 },
  { unique: true }
);

export default mongoose.models.CommentReaction ||
  mongoose.model("CommentReaction", commentReactionSchema);