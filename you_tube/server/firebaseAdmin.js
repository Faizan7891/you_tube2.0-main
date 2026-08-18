import "dotenv/config";
import { initializeApp, cert, getApps } from "firebase-admin/app";

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!process.env.FIREBASE_PROJECT_ID) {
  throw new Error("FIREBASE_PROJECT_ID is missing");
}

if (!process.env.FIREBASE_CLIENT_EMAIL) {
  throw new Error("FIREBASE_CLIENT_EMAIL is missing");
}

if (!privateKey) {
  throw new Error("FIREBASE_PRIVATE_KEY is missing");
}

const firebaseAdmin =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      })
    : getApps()[0];

export default firebaseAdmin;