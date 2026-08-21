import crypto from "crypto";

import razorpay from "../utils/razorpay.js";
import user from "../Modals/Auth.js";
import subscription from "../Modals/Subscription.js";

import {
  SUBSCRIPTION_PLANS,
} from "../config/subscriptionPlans.js";
import {
  sendSubscriptionEmail,
} from "../utils/email.js";

const getDurationMonths = (validity) => {
  if (validity === "monthly") return 1;
  if (validity === "quarterly") return 3;
  if (validity === "yearly") return 12;

  return 0;
};

const getExpiryDate = (
  startDate,
  validity
) => {
  const expiry = new Date(startDate);

  expiry.setMonth(
    expiry.getMonth() +
      getDurationMonths(validity)
  );

  return expiry;
};

export const getPlans = async (req, res) => {
  try {
    return res.status(200).json({
      plans: SUBSCRIPTION_PLANS,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Unable to fetch plans",
    });
  }
};

export const createSubscriptionOrder = async (
  req,
  res
) => {
  try {
    const { plan, validity } = req.body;

    if (
      !SUBSCRIPTION_PLANS[plan] ||
      plan === "free"
    ) {
      return res.status(400).json({
        message: "Invalid paid subscription plan",
      });
    }

    if (
      !["monthly", "quarterly", "yearly"].includes(
        validity
      )
    ) {
      return res.status(400).json({
        message: "Invalid validity period",
      });
    }

    const selectedPlan =
      SUBSCRIPTION_PLANS[plan];

    const amount =
      selectedPlan[validity];

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid subscription amount",
      });
    }

    const currentUser =
      await user.findOne({
        email: req.firebaseUser.email,
      });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const receipt =
      `sub_${currentUser._id}_${Date.now()}`;

    const order =
      await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt,
      });

    await subscription.create({
      userId: currentUser._id,

      plan,

      validity,

      amount,

      currency: "INR",

      orderId: order.id,

      paymentStatus: "created",
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,

      keyId:
        process.env.RAZORPAY_KEY_ID,

      plan,
      validity,
    });
  } catch (error) {
    console.error(
      "Create Razorpay order error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to create payment order",
    });
  }
};

export const verifySubscriptionPayment = async (
  req,
  res
) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: "Payment details are incomplete",
      });
    }

    const currentUser =
      await user.findOne({
        email: req.firebaseUser.email,
      });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Find our pending subscription
    const pendingSubscription =
      await subscription.findOne({
        userId: currentUser._id,
        orderId: razorpay_order_id,
        paymentStatus: "created",
      });

    if (!pendingSubscription) {
      return res.status(404).json({
        message:
          "Subscription payment order not found",
      });
    }

    // Verify Razorpay signature
    const generatedSignature =
      crypto
        .createHmac(
          "sha256",
          process.env.RAZORPAY_KEY_SECRET
        )
        .update(
          `${razorpay_order_id}|${razorpay_payment_id}`
        )
        .digest("hex");

    if (
      generatedSignature !==
      razorpay_signature
    ) {
      pendingSubscription.paymentStatus =
        "failed";

      await pendingSubscription.save();

      return res.status(400).json({
        message:
          "Payment verification failed",
      });
    }

    // Prevent duplicate payment processing
    if (
      pendingSubscription.paymentId &&
      pendingSubscription.paymentId ===
        razorpay_payment_id
    ) {
      return res.status(200).json({
        message:
          "Payment already verified",
      });
    }

    // Generate invoice number
    const invoiceNumber =
      `INV-${Date.now()}`;

    const startDate = new Date();

    const expiryDate =
      getExpiryDate(
        startDate,
        pendingSubscription.validity
      );

    // Update subscription transaction
    pendingSubscription.paymentId =
      razorpay_payment_id;

    pendingSubscription.invoiceNumber =
      invoiceNumber;

    pendingSubscription.paymentStatus =
      "paid";

    pendingSubscription.subscriptionStartDate =
      startDate;

    pendingSubscription.subscriptionExpiryDate =
      expiryDate;

    pendingSubscription.nextRenewalDate =
      expiryDate;

    await pendingSubscription.save();

    // Update user's active subscription
    currentUser.subscriptionPlan =
      pendingSubscription.plan;

    currentUser.subscriptionStartDate =
      startDate;

    currentUser.subscriptionExpiryDate =
      expiryDate;

    // Set download limits
    const downloadLimits = {
      bronze: {
        daily: 3,
        monthly: 90,
      },

      silver: {
        daily: 5,
        monthly: 150,
      },

      gold: {
        daily: 10,
        monthly: 300,
      },
    };

    const limits =
      downloadLimits[
        pendingSubscription.plan
      ];

    if (limits) {
      currentUser.dailyDownloadLimit =
        limits.daily;

      currentUser.monthlyDownloadLimit =
        limits.monthly;
    }

    await currentUser.save();

    // Send subscription confirmation email
    await sendSubscriptionEmail({
      email: currentUser.email,
      plan: pendingSubscription.plan,
      validity: pendingSubscription.validity,
      amount: pendingSubscription.amount,
      currency: pendingSubscription.currency,
      paymentId: pendingSubscription.paymentId,
      orderId: pendingSubscription.orderId,
      invoiceNumber: pendingSubscription.invoiceNumber,
      startDate: pendingSubscription.subscriptionStartDate,
      expiryDate: pendingSubscription.subscriptionExpiryDate,
    });

    return res.status(200).json({
      message:
        "Subscription activated successfully",

      subscription: {
        plan:
          pendingSubscription.plan,

        validity:
          pendingSubscription.validity,

        amount:
          pendingSubscription.amount,

        currency:
          pendingSubscription.currency,

        paymentId:
          pendingSubscription.paymentId,

        orderId:
          pendingSubscription.orderId,

        invoiceNumber:
          pendingSubscription.invoiceNumber,

        startDate,

        expiryDate,

        nextRenewalDate:
          expiryDate,
      },
    });
  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify payment",
    });
  }
};
export const processExpiredSubscriptions = async () => {
  try {
    const now = new Date();

    const expiredUsers = await user.find({
      subscriptionPlan: {
        $ne: "free",
      },
      subscriptionExpiryDate: {
        $lte: now,
      },
    });

    for (const currentUser of expiredUsers) {
      const scheduledPlan =
        currentUser.scheduledSubscriptionPlan;

      // Scheduled downgrade exists
      if (
        scheduledPlan &&
        scheduledPlan !== "free"
      ) {
        const newStartDate = new Date();

        // Scheduled downgrade gets monthly validity
        const newExpiryDate = new Date(
          newStartDate
        );

        newExpiryDate.setMonth(
          newExpiryDate.getMonth() + 1
        );

        currentUser.subscriptionPlan =
          scheduledPlan;

        currentUser.subscriptionStartDate =
          newStartDate;

        currentUser.subscriptionExpiryDate =
          newExpiryDate;

        const limits = {
          bronze: {
            daily: 3,
            monthly: 90,
          },
          silver: {
            daily: 5,
            monthly: 150,
          },
          gold: {
            daily: 10,
            monthly: 300,
          },
        };

        const planLimits =
          limits[scheduledPlan];

        currentUser.dailyDownloadLimit =
          planLimits.daily;

        currentUser.monthlyDownloadLimit =
          planLimits.monthly;

        currentUser.scheduledSubscriptionPlan =
          null;

        currentUser.scheduledSubscriptionValidity =
          null;

        await currentUser.save();

        continue;
      }

      // Scheduled downgrade to Free
      if (
        scheduledPlan === "free"
      ) {
        currentUser.subscriptionPlan =
          "free";

        currentUser.subscriptionStartDate =
          null;

        currentUser.subscriptionExpiryDate =
          null;

        currentUser.dailyDownloadLimit =
          1;

        currentUser.monthlyDownloadLimit =
          30;

        currentUser.scheduledSubscriptionPlan =
          null;

        currentUser.scheduledSubscriptionValidity =
          null;

        await currentUser.save();

        continue;
      }

      // No scheduled plan → Free
      currentUser.subscriptionPlan =
        "free";

      currentUser.subscriptionStartDate =
        null;

      currentUser.subscriptionExpiryDate =
        null;

      currentUser.dailyDownloadLimit =
        1;

      currentUser.monthlyDownloadLimit =
        30;

      await currentUser.save();
    }

    console.log(
      `Subscription expiry check completed. Processed: ${expiredUsers.length}`
    );
  } catch (error) {
    console.error(
      "Subscription expiry processing error:",
      error
    );
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const currentUser = await user.findOne({
      email: req.firebaseUser.email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Automatically downgrade expired subscription
    if (
      currentUser.subscriptionPlan !== "free" &&
      currentUser.subscriptionExpiryDate &&
      new Date(currentUser.subscriptionExpiryDate) <= new Date()
    ) {
      currentUser.subscriptionPlan = "free";
      currentUser.dailyDownloadLimit = 1;
      currentUser.monthlyDownloadLimit = 30;
      currentUser.subscriptionExpiryDate = null;

      await currentUser.save();
    }

    const history = await subscription
      .find({
        userId: currentUser._id,
      })
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      currentSubscription: {
        plan: currentUser.subscriptionPlan || "free",
        startDate: currentUser.subscriptionStartDate,
        expiryDate: currentUser.subscriptionExpiryDate,
        dailyDownloadLimit:
          currentUser.dailyDownloadLimit || 1,
        monthlyDownloadLimit:
          currentUser.monthlyDownloadLimit || 30,
      },

      billingHistory: history,
    });
  } catch (error) {
    console.error(
      "Get subscription error:",
      error
    );

    return res.status(500).json({
      message: "Unable to fetch subscription",
    });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const currentUser = await user.findOne({
      email: req.firebaseUser.email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (currentUser.subscriptionPlan === "free") {
      return res.status(400).json({
        message:
          "You do not have an active paid subscription",
      });
    }

    const activeSubscription =
      await subscription
        .findOne({
          userId: currentUser._id,
          plan: currentUser.subscriptionPlan,
          paymentStatus: "paid",
          subscriptionExpiryDate: {
            $gt: new Date(),
          },
        })
        .sort({
          createdAt: -1,
        });

    if (!activeSubscription) {
      return res.status(404).json({
        message: "Active subscription not found",
      });
    }

    activeSubscription.autoRenew = false;
    activeSubscription.cancelledAt = new Date();

    await activeSubscription.save();

    return res.status(200).json({
      message:
        "Subscription cancellation scheduled successfully",

      expiryDate:
        activeSubscription.subscriptionExpiryDate,
    });
  } catch (error) {
    console.error(
      "Cancel subscription error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to cancel subscription",
    });
  }
};

export const scheduleDowngrade = async (req, res) => {
  try {
    const { plan } = req.body;

    const allowedPlans = [
      "free",
      "bronze",
      "silver",
      "gold",
    ];

    if (!allowedPlans.includes(plan)) {
      return res.status(400).json({
        message: "Invalid downgrade plan",
      });
    }

    const currentUser = await user.findOne({
      email: req.firebaseUser.email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const currentPlan =
      currentUser.subscriptionPlan || "free";

    const planOrder = {
      free: 0,
      bronze: 1,
      silver: 2,
      gold: 3,
    };

    // Cannot downgrade to same or higher plan
    if (
      planOrder[plan] >=
      planOrder[currentPlan]
    ) {
      return res.status(400).json({
        message:
          "Selected plan is not a downgrade",
      });
    }

    // Free users cannot schedule a downgrade
    if (currentPlan === "free") {
      return res.status(400).json({
        message:
          "You are already on the Free plan",
      });
    }

    // Make sure current subscription is still active
    if (
      !currentUser.subscriptionExpiryDate ||
      new Date(
        currentUser.subscriptionExpiryDate
      ) <= new Date()
    ) {
      return res.status(400).json({
        message:
          "Current subscription has expired",
      });
    }

    currentUser.scheduledSubscriptionPlan =
      plan;

    currentUser.scheduledSubscriptionValidity =
      "monthly";

    await currentUser.save();

    return res.status(200).json({
      message:
        `Downgrade to ${plan} scheduled successfully`,
      scheduledPlan: plan,
      effectiveDate:
        currentUser.subscriptionExpiryDate,
    });
  } catch (error) {
    console.error(
      "Schedule downgrade error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to schedule downgrade",
    });
  }
};