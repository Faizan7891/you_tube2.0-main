import express from "express";

import {
  replyToComment,
  searchMentionUsers,
  reportComment,
  deletecomment,
  getallcomment,
  postcomment,
  editcomment,
  getReportedComments,
dismissReport,
deleteReportedComment,
} from "../controllers/comment.js";

import commentRateLimit from "../middleware/commentRateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const routes = express.Router();

// ===============================
// REPORT COMMENT
// ===============================
routes.post(
  "/report/:commentId",
  requireAuth,
  reportComment
);

// ===============================
// CREATE COMMENT
// ===============================
routes.post(
  "/postcomment",
  commentRateLimit,
  requireAuth,
  postcomment
);

// ===============================
// REPLY TO COMMENT
// ===============================
routes.post(
  "/reply/:parentCommentId",
  commentRateLimit,
  requireAuth,
  replyToComment
);

// ===============================
// MENTION USER SEARCH
// ===============================
routes.get(
  "/users",
  searchMentionUsers
);

// ===============================
// GET COMMENTS
// ===============================
routes.get(
  "/:videoid",
  getallcomment
);

// ===============================
// DELETE COMMENT
// ===============================
routes.delete(
  "/deletecomment/:id",
  requireAuth,
  deletecomment
);

// ===============================
// EDIT COMMENT
// ===============================
routes.post(
  "/editcomment/:id",
  requireAuth,
  editcomment
);

// ===============================
// ADMIN MODERATION
// ===============================

routes.get(
  "/admin/reports",
  requireAuth,
  getReportedComments
);

routes.patch(
  "/admin/reports/:reportId/dismiss",
  requireAuth,
  dismissReport
);

routes.delete(
  "/admin/reports/:reportId/comment",
  requireAuth,
  deleteReportedComment
);

export default routes;