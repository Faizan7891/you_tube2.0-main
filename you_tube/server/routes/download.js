import express from "express";

import {
  downloadVideo,
  getMyDownloads,
} from "../controllers/download.js";

import { verifyToken } from "../middleware/authMiddleware.js";

const routes = express.Router();

// Get logged-in user's download history
routes.get("/my", verifyToken, getMyDownloads);

// Download a specific video
routes.get("/:videoId", verifyToken, downloadVideo);

export default routes;