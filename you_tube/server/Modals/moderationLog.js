import mongoose from "mongoose";

const moderationLogSchema = new mongoose.Schema(
  {
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "commentReport",
      required: true,
    },

    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      required: true,
    },

    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    action: {
      type: String,
      enum: ["dismissed", "deleted"],
      required: true,
    },

    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.moderationLog ||
  mongoose.model("moderationLog", moderationLogSchema);