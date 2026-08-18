import mongoose from "mongoose";

const commentHistorySchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    action: {
      type: String,
      enum: ["CREATED", "EDITED", "DELETED"],
      required: true,
    },

    oldText: {
      type: String,
      default: "",
    },

    newText: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.commentHistory ||
  mongoose.model("commentHistory", commentHistorySchema);