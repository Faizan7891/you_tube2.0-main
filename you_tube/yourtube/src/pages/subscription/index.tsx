import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosinstance";
import { useUser } from "@/lib/AuthContext";
import { loadRazorpay } from "@/lib/razorpay";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const Subscription = () => {
  const { user } = useUser();

  const [plans, setPlans] = useState<any>({});
  const [selectedValidity, setSelectedValidity] =
    useState("monthly");

  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] =
    useState(false);

  const [currentSubscription, setCurrentSubscription] =
    useState<any>(null);

  const [billingHistory, setBillingHistory] =
    useState<any[]>([]);

  // --------------------------------------------------
  // FETCH PLANS
  // --------------------------------------------------

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response =
          await axiosInstance.get(
            "/subscription/plans"
          );

        setPlans(
          response.data.plans || {}
        );
      } catch (error) {
        console.error(
          "Failed to load plans:",
          error
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // --------------------------------------------------
  // FETCH CURRENT SUBSCRIPTION
  // --------------------------------------------------

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user) return;

      try {
        const response =
          await axiosInstance.get(
            "/subscription/my"
          );

        setCurrentSubscription(
          response.data.currentSubscription
        );

        setBillingHistory(
          response.data.billingHistory || []
        );
      } catch (error) {
        console.error(
          "Failed to load subscription:",
          error
        );
      }
    };

    fetchSubscription();
  }, [user]);

  // --------------------------------------------------
  // SUBSCRIBE / UPGRADE / RENEW
  // --------------------------------------------------

  const handleSubscribe = async (
    plan: string
  ) => {
    if (!user) {
      alert(
        "Please login before subscribing."
      );
      return;
    }

    // Free plan should not open Razorpay
    if (plan === "free") {
      alert(
        "Free plan does not require payment."
      );
      return;
    }

    try {
      setPaymentLoading(true);

      // Load Razorpay
      const razorpayLoaded =
        await loadRazorpay();

      if (!razorpayLoaded) {
        alert(
          "Razorpay failed to load."
        );

        setPaymentLoading(false);
        return;
      }

      // --------------------------------------------------
      // CREATE ORDER
      // --------------------------------------------------

      const orderResponse =
        await axiosInstance.post(
          "/subscription/create-order",
          {
            plan,
            validity:
              selectedValidity,
          }
        );

      const {
        orderId,
        amount,
        currency,
        keyId,
      } = orderResponse.data;

      // --------------------------------------------------
      // RAZORPAY CHECKOUT
      // --------------------------------------------------

      const options = {
        key: keyId,

        amount,

        currency,

        name: "YourTube",

        description:
          `${plan} Subscription`,

        order_id: orderId,

        prefill: {
          email: user.email || "",
        },

        theme: {
          color: "#000000",
        },

        handler: async (
          response: any
        ) => {
          try {
            // --------------------------------------------------
            // VERIFY PAYMENT ON BACKEND
            // --------------------------------------------------

            const verifyResponse =
              await axiosInstance.post(
                "/subscription/verify-payment",
                {
                  razorpay_order_id:
                    response.razorpay_order_id,

                  razorpay_payment_id:
                    response.razorpay_payment_id,

                  razorpay_signature:
                    response.razorpay_signature,
                }
              );

            alert(
              verifyResponse.data
                .message ||
                "Subscription activated successfully!"
            );

            window.location.reload();
          } catch (error: any) {
            console.error(
              "Payment verification failed:",
              error
            );

            alert(
              error.response?.data
                ?.message ||
                "Payment verification failed."
            );

            setPaymentLoading(false);
          }
        },

        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
          },
        },
      };

      const razorpay =
        new window.Razorpay(
          options
        );

      // --------------------------------------------------
      // PAYMENT FAILED
      // --------------------------------------------------

      razorpay.on(
        "payment.failed",
        (response: any) => {
          console.error(
            "Payment failed:",
            response
          );

          alert(
            "Payment failed. Your subscription was not activated."
          );

          setPaymentLoading(false);
        }
      );

      razorpay.open();
    } catch (error: any) {
      console.error(
        "Subscription error:",
        error
      );

      alert(
        error.response?.data
          ?.message ||
          "Unable to start payment."
      );

      setPaymentLoading(false);
    }
  };

  // --------------------------------------------------
  // CANCEL SUBSCRIPTION
  // --------------------------------------------------

  const handleCancelSubscription =
    async () => {
      const confirmed =
        window.confirm(
          "Are you sure you want to cancel your subscription? Your premium access will remain active until the expiry date."
        );

      if (!confirmed) {
        return;
      }

      try {
        await axiosInstance.post(
          "/subscription/cancel"
        );

        alert(
          "Subscription cancellation scheduled successfully."
        );

        window.location.reload();
      } catch (error: any) {
        console.error(
          "Cancel subscription error:",
          error
        );

        alert(
          error.response?.data
            ?.message ||
            "Unable to cancel subscription."
        );
      }
    };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="flex-1 p-6">
        Loading subscription plans...
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------


  const handleDowngrade = async (
  plan: string
) => {
  const confirmed = window.confirm(
    `Your current subscription will remain active until its expiry date. After that, your plan will change to ${plan}. Continue?`
  );

  if (!confirmed) {
    return;
  }

  try {
    await axiosInstance.post(
      "/subscription/downgrade",
      {
        plan,
      }
    );

    alert(
      `Downgrade to ${plan} scheduled successfully.`
    );

    window.location.reload();
  } catch (error: any) {
    console.error(
      "Downgrade error:",
      error
    );

    alert(
      error.response?.data?.message ||
        "Unable to schedule downgrade."
    );
  }
};
  return (
    <main className="flex-1 p-6">
      <div className="max-w-6xl mx-auto">

        {/* PAGE TITLE */}
        <h1 className="text-3xl font-bold mb-2">
          Subscription Plans
        </h1>

        <p className="text-gray-500 mb-8">
          Choose the plan that works best
          for you.
        </p>

        {/* --------------------------------------------------
            CURRENT SUBSCRIPTION
        -------------------------------------------------- */}

        {currentSubscription && (
          <div className="border rounded-xl p-6 mb-8">

            <h2 className="text-xl font-bold mb-4">
              Current Subscription
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* PLAN */}

              <div>
                <p className="text-sm text-gray-500">
                  Plan
                </p>

                <p className="font-semibold capitalize">
                  {currentSubscription.plan}
                </p>
              </div>

              {/* START DATE */}

              <div>
                <p className="text-sm text-gray-500">
                  Start Date
                </p>

                <p className="font-semibold">
                  {currentSubscription.startDate
                    ? new Date(
                        currentSubscription.startDate
                      ).toLocaleDateString()
                    : "-"}
                </p>
              </div>

              {/* EXPIRY DATE */}

              <div>
                <p className="text-sm text-gray-500">
                  Expiry Date
                </p>

                <p className="font-semibold">
                  {currentSubscription.expiryDate
                    ? new Date(
                        currentSubscription.expiryDate
                      ).toLocaleDateString()
                    : "No expiry"}
                </p>
              </div>

              {/* DAILY DOWNLOADS */}

              <div>
                <p className="text-sm text-gray-500">
                  Daily Downloads
                </p>

                <p className="font-semibold">
                  {
                    currentSubscription.dailyDownloadLimit
                  }
                </p>
              </div>

            </div>

            {/* CANCEL BUTTON */}

            {currentSubscription.plan !==
              "free" && (
              <button
                onClick={
                  handleCancelSubscription
                }
                className="mt-5 px-4 py-2 rounded-lg border border-red-500 text-red-500 hover:bg-red-50"
              >
                Cancel Subscription
              </button>
            )}

          </div>
        )}

        {/* --------------------------------------------------
            VALIDITY
        -------------------------------------------------- */}

        <div className="flex gap-3 mb-8">

          {[
            "monthly",
            "quarterly",
            "yearly",
          ].map((validity) => (
            <button
              key={validity}
              onClick={() =>
                setSelectedValidity(
                  validity
                )
              }
              className={`px-5 py-2 rounded-lg border capitalize ${
                selectedValidity ===
                validity
                  ? "bg-black text-white"
                  : "bg-white"
              }`}
            >
              {validity}
            </button>
          ))}

        </div>

        {/* --------------------------------------------------
            PLANS
        -------------------------------------------------- */}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

          {Object.entries(plans).map(
            ([planKey, plan]: [
              string,
              any
            ]) => (

              <div
                key={planKey}
                className="border rounded-xl p-5 bg-white"
              >

                {/* PLAN NAME */}

                <h2 className="text-xl font-bold capitalize">
                  {plan.name}
                </h2>

                {/* PRICE */}

                <div className="mt-4 mb-5">

                  <span className="text-3xl font-bold">
                    ₹
                    {
                      plan[
                        selectedValidity
                      ]
                    }
                  </span>

                  <span className="text-gray-500">
                    /
                    {selectedValidity}
                  </span>

                </div>

                {/* FEATURES */}

                <ul className="space-y-2 mb-6">

                  {plan.features?.map(
                    (
                      feature: string,
                      index: number
                    ) => (

                      <li
                        key={index}
                        className="text-sm"
                      >
                        ✓ {feature}
                      </li>

                    )
                  )}

                </ul>

                {/* --------------------------------------------------
                    PLAN ACTION BUTTON
                -------------------------------------------------- */}

                {(() => {

                  const planOrder:
                    Record<
                      string,
                      number
                    > = {
                    free: 0,
                    bronze: 1,
                    silver: 2,
                    gold: 3,
                  };

                  const currentPlan =
                    currentSubscription?.plan ||
                    "free";

                  const selectedPlan =
                    planKey;

                  let buttonText =
                    "Subscribe";

                  let isDisabled =
                    paymentLoading;

                  // CURRENT PLAN

                  if (
                    selectedPlan ===
                    currentPlan
                  ) {

                    buttonText =
                      selectedPlan ===
                      "free"
                        ? "Current Plan"
                        : "Renew";

                  }

                  // UPGRADE

                  else if (
                    planOrder[
                      selectedPlan
                    ] >
                    planOrder[
                      currentPlan
                    ]
                  ) {

                    buttonText =
                      "Upgrade";

                  }

                  // DOWNGRADE

                  else {

                    buttonText =
                      "Downgrade";

                    // Free plan currently
                    // does not open Razorpay.
                    // Scheduled downgrade
                    // will be implemented
                    // in the backend.

                    if (
                      selectedPlan ===
                      "free"
                    ) {
                      isDisabled = true;
                    }

                  }

                  return (
                    <button
                      disabled={
                        isDisabled
                      }
                     onClick={() => {
  if (
    selectedPlan !== "free" &&
    planOrder[selectedPlan] >
      planOrder[currentPlan]
  ) {
    // Upgrade
    handleSubscribe(selectedPlan);
  } else if (
    planOrder[selectedPlan] <
      planOrder[currentPlan]
  ) {
    // Downgrade
    handleDowngrade(selectedPlan);
  } else if (
    selectedPlan === currentPlan &&
    selectedPlan !== "free"
  ) {
    // Renew
    handleSubscribe(selectedPlan);
  }
}}
                      className="w-full py-2 rounded-lg bg-black text-white disabled:opacity-50"
                    >
                      {paymentLoading
                        ? "Processing..."
                        : buttonText}
                    </button>
                  );

                })()}

              </div>

            )
          )}

        </div>

        {/* --------------------------------------------------
            BILLING HISTORY
        -------------------------------------------------- */}

        <div className="mt-10">

          <h2 className="text-xl font-bold mb-4">
            Billing History
          </h2>

          {billingHistory.length ===
          0 ? (

            <p className="text-gray-500">
              No billing history yet.
            </p>

          ) : (

            <div className="space-y-3">

              {billingHistory.map(
                (payment) => (

                  <div
                    key={payment._id}
                    className="border rounded-lg p-4"
                  >

                    <div className="flex flex-col md:flex-row md:justify-between gap-3">

                      {/* PAYMENT DETAILS */}

                      <div>

                        <p className="font-semibold capitalize">
                          {payment.plan} —{" "}
                          {payment.validity}
                        </p>

                        <p className="text-sm text-gray-500">
                          Invoice:{" "}
                          {payment.invoiceNumber ||
                            "Pending"}
                        </p>

                        <p className="text-sm text-gray-500">
                          Payment ID:{" "}
                          {payment.paymentId ||
                            "Pending"}
                        </p>

                        <p className="text-sm text-gray-500">
                          Order ID:{" "}
                          {payment.orderId}
                        </p>

                      </div>

                      {/* PAYMENT AMOUNT */}

                      <div>

                        <p className="font-semibold">
                          ₹
                          {
                            payment.amount
                          }
                        </p>

                        <p className="text-sm capitalize">
                          {
                            payment.paymentStatus
                          }
                        </p>

                      </div>

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </div>

      </div>
    </main>
  );
};

export default Subscription;