import { getAuth } from "firebase-admin/auth";
import firebaseAdmin from "../firebaseAdmin.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const idToken = authorization.substring(7);

    const decodedToken = await getAuth(firebaseAdmin).verifyIdToken(idToken);

    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
};