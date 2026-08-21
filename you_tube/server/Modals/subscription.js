import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },

    plan: {
      type: String,
      enum: ["free", "bronze", "silver", "gold"],
      required: true,
    },

    validity: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paymentId: {
      type: String,
      default: null,
    },

    orderId: {
      type: String,
      default: null,
    },

    invoiceNumber: {
      type: String,
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: [
        "created",
        "pending",
        "paid",
        "failed",
        "cancelled",
      ],
      default: "created",
    },

    subscriptionStartDate: {
      type: Date,
      default: null,
    },

    subscriptionExpiryDate: {
      type: Date,
      default: null,
    },

    nextRenewalDate: {
      type: Date,
      default: null,
    },

    autoRenew: {
      type: Boolean,
      default: false,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "subscription",
  subscriptionSchema
);