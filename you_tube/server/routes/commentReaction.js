import express from "express";

import {
  reactToComment,
  getCommentReactions,
} from "../controllers/commentReaction.js";

import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Anyone can view reaction counts
router.get("/:commentId", getCommentReactions);

// Only logged-in users can like/dislike
router.post("/:commentId", requireAuth, reactToComment);

export default router;