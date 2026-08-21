import mongoose from "mongoose";

const userschema = mongoose.Schema({
  email: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  name: {
    type: String,
  },

  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },

  channelname: {
    type: String,
  },

  description: {
    type: String,
  },

  image: {
    type: String,
  },

  location: {
    type: String,
    default: "Location not set",
    trim: true,
  },

  joinedon: {
    type: Date,
    default: Date.now,
  },

  // =========================
  // SUBSCRIPTION
  // =========================

  subscriptionPlan: {
    type: String,
    enum: ["free", "bronze", "silver", "gold"],
    default: "free",
  },

  subscriptionStartDate: {
    type: Date,
    default: null,
  },

  subscriptionExpiryDate: {
    type: Date,
    default: null,
  },

  scheduledSubscriptionPlan: {
    type: String,
    enum: ["free", "bronze", "silver", "gold"],
    default: null,
  },

  scheduledSubscriptionValidity: {
    type: String,
    enum: ["monthly", "quarterly", "yearly"],
    default: null,
  },

  // =========================
  // DOWNLOAD LIMITS
  // =========================

  dailyDownloadLimit: {
    type: Number,
    default: 1,
  },

  monthlyDownloadLimit: {
    type: Number,
    default: 30,
  },

  // =========================
  // REGISTERED DEVICE
  // =========================

  registeredDeviceId: {
    type: String,
    default: null,
  },

  // =========================
  // THEME
  // =========================

  theme: {
    type: String,
    enum: ["light", "dark"],
    default: "dark",
  },

  // =========================
  // TRUSTED DEVICES
  // =========================

  trustedDevices: [
    {
      deviceId: {
        type: String,
        required: true,
      },

      browser: {
        type: String,
        default: "unknown",
      },

      deviceType: {
        type: String,
        default: "Unknown",
      },

      ipAddress: {
        type: String,
        default: "unknown",
      },

      trustedUntil: {
        type: Date,
        required: true,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // =========================
  // LOGIN OTP
  // =========================

  otpCode: {
    type: String,
    default: null,
  },

  otpExpiresAt: {
    type: Date,
    default: null,
  },

  otpAttempts: {
    type: Number,
    default: 0,
  },

  otpVerified: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model("user", userschema);