import mongoose from "mongoose";

const downloadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
      index: true,
    },

    downloadDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    ipAddress: {
      type: String,
      default: "unknown",
    },

    deviceInfo: {
      type: String,
      default: "unknown",
    },

    deviceId: {
  type: String,
  required: true,
},

    browser: {
      type: String,
      default: "unknown",
    },

    subscriptionPlan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      required: true,
    },

    fileSize: {
      type: String,
      default: "unknown",
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed", "interrupted"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("download", downloadSchema);