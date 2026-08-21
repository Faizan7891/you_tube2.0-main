import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    ipAddress: {
      type: String,
      default: "unknown",
    },

    browser: {
      type: String,
      default: "unknown",
    },

    browserVersion: {
      type: String,
      default: "unknown",
    },

    operatingSystem: {
      type: String,
      default: "unknown",
    },

    deviceType: {
      type: String,
      enum: [
        "Desktop",
        "Mobile",
        "Tablet",
        "Unknown",
      ],
      default: "Unknown",
    },

    deviceModel: {
      type: String,
      default: "unknown",
    },

    city: {
      type: String,
      default: "unknown",
    },

    state: {
      type: String,
      default: "unknown",
    },

    country: {
      type: String,
      default: "unknown",
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    loginTimestamp: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: [
        "success",
        "failed",
        "otp_required",
        "otp_verified",
      ],
      default: "success",
    },

    otpRequired: {
      type: Boolean,
      default: false,
    },

    otpVerified: {
      type: Boolean,
      default: false,
    },

    deviceId: {
      type: String,
      default: null,
    },

    trustedDevice: {
      type: Boolean,
      default: false,
    },

    trustedUntil: {
      type: Date,
      default: null,
    },city: {
  type: String,
  default: "Unknown",
},

state: {
  type: String,
  default: "Unknown",
},

country: {
  type: String,
  default: "Unknown",
},

latitude: {
  type: Number,
  default: null,
},

longitude: {
  type: Number,
  default: null,
},

location: {
  type: String,
  default: "Unknown",
},
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "loginHistory",
  loginHistorySchema
);