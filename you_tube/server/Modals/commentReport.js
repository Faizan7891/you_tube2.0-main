import mongoose from "mongoose";

const commentReportSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      required: true,
    },

    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "offensive",
        "other",
      ],
      required: true,
    },

 status: {
  type: String,
  enum: [
    "pending",
    "reviewed",
    "dismissed",
    "deleted",
  ],
  default: "pending",
},

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// One user cannot report the same comment twice
commentReportSchema.index(
  {
    commentId: 1,
    reporterId: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.models.commentReport ||
  mongoose.model(
    "commentReport",
    commentReportSchema
  );