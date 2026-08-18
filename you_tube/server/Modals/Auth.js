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

  // Subscription details
  subscriptionPlan: {
    type: String,
    enum: ["free", "bronze", "silver", "gold"],
    default: "free",
  },

  subscriptionStartDate: {
    type: Date,
    default: Date.now,
  },

  subscriptionExpiryDate: {
    type: Date,
    default: null,
  },

  // Download limits
  dailyDownloadLimit: {
    type: Number,
    default: 1,
  },

  monthlyDownloadLimit: {
    type: Number,
    default: 30,
  },
  registeredDeviceId: {
  type: String,
  default: null,
},
});

export default mongoose.model("user", userschema);