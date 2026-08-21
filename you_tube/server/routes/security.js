import express from "express";

import {
  getSecurityInfo,
  revokeTrustedDevice,
} from "../controllers/security.js";

import {
  verifyToken,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  verifyToken,
  getSecurityInfo
);

router.delete(
  "/trusted-device/:deviceId",
  verifyToken,
  revokeTrustedDevice
);

export default router;