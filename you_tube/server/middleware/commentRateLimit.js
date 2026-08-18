import rateLimit from "express-rate-limit";

const commentRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,

  skip: (req) => {
  return Boolean(req.body?.altcha);
},

  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    return res.status(429).json({
      captchaRequired: true,
      message:
        "You've posted too many comments. Please complete CAPTCHA to continue.",
    });
  },
});

export default commentRateLimit;