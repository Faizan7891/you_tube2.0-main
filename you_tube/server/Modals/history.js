import mongoose from "mongoose";

const historyschema = mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },

    // Watch progress in seconds
    watchPosition: {
      type: Number,
      default: 0,
    },

    // Video duration in seconds
    videoDuration: {
      type: Number,
      default: 0,
    },

    // Percentage watched
    watchPercentage: {
      type: Number,
      default: 0,
    },

    // Whether the video has been completed
    completed: {
      type: Boolean,
      default: false,
    },

    likedon: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("history", historyschema);