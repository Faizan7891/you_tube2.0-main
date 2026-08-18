import express from "express";
import { createChallenge } from "altcha-lib/v1";

const router = express.Router();

router.get("/challenge", async (req, res) => {
  try {
    const challenge = await createChallenge({
      hmacKey: process.env.ALTCHA_HMAC_KEY,
      maxNumber: 100000,
    });

    res.json(challenge);
  } catch (error) {
    console.error("ALTCHA challenge error:", error);

    res.status(500).json({
      message: "Unable to generate CAPTCHA.",
    });
  }
});

export default router;