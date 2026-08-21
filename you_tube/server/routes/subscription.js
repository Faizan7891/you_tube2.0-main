import express from "express";

import {
  getPlans,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  getMySubscription,
   cancelSubscription,
    scheduleDowngrade,    
} from "../controllers/subscription.js";

import {
  verifyToken,
} from "../middleware/authMiddleware.js";

const routes = express.Router();

routes.get(
  "/plans",
  getPlans
);

routes.post(
  "/create-order",
  verifyToken,
  createSubscriptionOrder
);

routes.post(
  "/verify-payment",
  verifyToken,
  verifySubscriptionPayment
);

routes.get(
  "/my",
  verifyToken,
  getMySubscription
);

routes.post(
  "/cancel",
  verifyToken,
  cancelSubscription
);

routes.post(
  "/downgrade",
  verifyToken,
  scheduleDowngrade
);


export default routes;