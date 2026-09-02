import express from "express";

import {
  getallhistoryVideo,
  handlehistory,
  handleview,
  saveWatchProgress,
  getWatchProgress,
} from "../controllers/history.js";

const routes = express.Router();

// Get complete watch history
routes.get(
  "/:userId",
  getallhistoryVideo
);

// Get watch progress for one video
routes.get(
  "/progress/:videoId",
  getWatchProgress
);

// Increment video view
routes.post(
  "/views/:videoId",
  handleview
);

// Create history entry
routes.post(
  "/:videoId",
  handlehistory
);

// Save watch progress
routes.post(
  "/progress/:videoId",
  saveWatchProgress
);

export default routes;