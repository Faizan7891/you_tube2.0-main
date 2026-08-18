import mongoose from "mongoose";

const downloadQuotaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    periodType: {
      type: String,
      enum: ["daily", "monthly"],
      required: true,
    },

    periodStart: {
      type: Date,
      required: true,
    },

    used: {
      type: Number,
      default: 0,
    },

    limit: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

downloadQuotaSchema.index(
  {
    userId: 1,
    periodType: 1,
    periodStart: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model(
  "downloadQuota",
  downloadQuotaSchema
);