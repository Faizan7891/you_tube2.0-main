import comment from "../Modals/comment.js";
import users from "../Modals/Auth.js";
import mongoose from "mongoose";
import {
  validateCommentSafety,
} from "../utils/commentSafety.js";
import commentReport from "../Modals/commentReport.js";
import moderationLog from "../Modals/moderationLog.js";
import commentHistory from "../Modals/commentHistory.js";
import { verifySolution } from "altcha-lib/v1";

// Get the MongoDB user from the verified Firebase identity
const getAuthenticatedUser = async (req) => {
  const firebaseEmail = req.firebaseUser?.email;

  if (!firebaseEmail) {
    return null;
  }

  return await users.findOne({ email: firebaseEmail });
};

const getAdminUser = async (req) => {
  const user = await getAuthenticatedUser(req);

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
};
const extractMentions = (text) => {
  const matches = text.match(/@[a-zA-Z0-9_]+/g);

  if (!matches) {
    return [];
  }

  return [
    ...new Set(
      matches.map((mention) =>
        mention.substring(1).toLowerCase()
      )
    ),
  ];
};
// CREATE COMMENT
export const postcomment = async (req, res) => {
  // CAPTCHA verification
  if (req.body.altcha) {
    try {
      const captchaValid = await verifySolution(
        req.body.altcha,
        process.env.ALTCHA_HMAC_KEY,
        true
      );

      if (!captchaValid) {
        return res.status(403).json({
          message: "CAPTCHA verification failed. Please try again.",
        });
      }
    } catch (error) {
      console.error("CAPTCHA verification error:", error);

      return res.status(403).json({
        message: "CAPTCHA verification failed. Please try again.",
      });
    }
  }
  try {
    const { videoid, commentbody, parentCommentId } = req.body;
    const trimmedComment = commentbody?.trim();
    const mentions = extractMentions(trimmedComment);

    const safetyCheck =
      validateCommentSafety(trimmedComment);

    if (!safetyCheck.allowed) {
      return res.status(400).json({
        message: safetyCheck.message,
      });
    }

    // Empty comment validation
    if (!videoid || !trimmedComment) {
      return res.status(400).json({
        message: "Comment cannot be empty",
      });
    }

    // Maximum 500 characters
    if (trimmedComment.length > 500) {
      return res.status(400).json({
        message: "Comment cannot exceed 500 characters",
      });
    }

    // Get authenticated MongoDB user
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    const duplicateComment =
      await comment.findOne({
        userid: user._id,
        videoid,
        commentbody: trimmedComment,
        parentCommentId: null,
      });

    if (duplicateComment) {
      return res.status(409).json({
        message:
          "You have already posted this comment.",
      });
    }

    const newComment = new comment({
      userid: user._id,
      videoid,
      mentions,
      parentCommentId: parentCommentId || null,
      commentbody: trimmedComment,
      usercommented: user.name,
    });

    await newComment.save();

    await commentHistory.create({
      commentId: newComment._id,
      userId: user._id,
      action: "CREATED",
      oldText: "",
      newText: trimmedComment,
    });

    return res.status(201).json({
      comment: true,
      data: newComment,
    });
  } catch (error) {
    console.error("Post comment error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// GET COMMENTS FOR A VIDEO
// GET COMMENTS FOR A VIDEO
export const getallcomment = async (req, res) => {
  const { videoid } = req.params;

  try {
    const commentvideo = await comment
      .find({ videoid })
      .populate("userid", "name username image location")
      .sort({ createdAt: -1 });

    const formattedComments = commentvideo.map((item) => ({
      ...item.toObject(),

      username:
        item.userid?.username ||
        item.userid?.name ||
        item.usercommented ||
        "Anonymous",

      profileImage: item.userid?.image || "",

      location:
        item.userid?.location ||
        "Location not set",

      postedAt: item.commentedon || item.createdAt,

      isEdited: item.isEdited || false,
    }));

    return res.status(200).json(formattedComments);
  } catch (error) {
    console.error("Get comments error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// DELETE OWN COMMENT
export const deletecomment = async (req, res) => {
  const { id: _id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({
      message: "Comment unavailable",
    });
  }

  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    const existingComment = await comment.findById(_id);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found",
      });
    }

    // Ownership check
    if (
      existingComment.userid.toString() !==
      user._id.toString()
    ) {
      return res.status(403).json({
        message:
          "You can only delete your own comments",
      });
    }

    // 10-minute edit/delete window
    const TEN_MINUTES = 10 * 60 * 1000;

    const commentAge =
      Date.now() -
      new Date(
        existingComment.createdAt ||
        existingComment.commentedon
      ).getTime();

    if (commentAge > TEN_MINUTES) {
      return res.status(403).json({
        message:
          "Delete time limit has expired. Comments can only be deleted within 10 minutes.",
      });
    }

    await commentHistory.create({
      commentId: existingComment._id,
      userId: user._id,
      action: "DELETED",
      oldText: existingComment.commentbody,
      newText: "",
    });

    await comment.findByIdAndUpdate(
      _id,
      {
        $set: {
          status: "deleted",
          deletedAt: new Date(),
          commentbody: "",
        },
      },
      {
        new: true,
      }
    );
    return res.status(200).json({
      comment: true,
    });
  } catch (error) {
    console.error(
      "Delete comment error:",
      error
    );

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// EDIT OWN COMMENT
export const editcomment = async (req, res) => {
  const { id: _id } = req.params;
  const { commentbody, editVersion } = req.body;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(404).json({
      message: "Comment unavailable",
    });
  }

  if (!commentbody?.trim()) {
    return res.status(400).json({
      message: "Comment cannot be empty",
    });
  }

  if (commentbody.trim().length > 500) {
    return res.status(400).json({
      message:
        "Comment cannot exceed 500 characters",
    });
  }

  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(404).json({
        message: "User account not found",
      });
    }

    const existingComment =
      await comment.findById(_id);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found",
      });
    }

    // Ownership check
    if (
      existingComment.userid.toString() !==
      user._id.toString()
    ) {
      return res.status(403).json({
        message:
          "You can only edit your own comments",
      });
    }

    // 10-minute edit/delete window
    const TEN_MINUTES = 10 * 60 * 1000;

    const commentAge =
      Date.now() -
      new Date(
        existingComment.createdAt ||
        existingComment.commentedon
      ).getTime();

    if (commentAge > TEN_MINUTES) {
      return res.status(403).json({
        message:
          "Edit time limit has expired. Comments can only be edited within 10 minutes.",
      });
    }

    const updatedComment =
      await comment.findOneAndUpdate(
        {
          _id,
          editVersion: editVersion ?? 0,
        },
        {
          $set: {
            commentbody:
              commentbody.trim(),
            isEdited: true,
            editedAt: new Date(),
          },
          $inc: {
            editVersion: 1,
          },
        },

        {
          new: true,
        }
      );

    if (!updatedComment) {
      return res.status(409).json({
        message:
          "This comment was updated. Please refresh before editing again.",
      });
    }


    await commentHistory.create({
      commentId: existingComment._id,
      userId: user._id,
      action: "EDITED",
      oldText: existingComment.commentbody,
      newText: commentbody.trim(),
    });

    return res.status(200).json(
      updatedComment
    );
  } catch (error) {
    console.error(
      "Edit comment error:",
      error
    );

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const replyToComment = async (req, res) => {
  try {
    const { parentCommentId } = req.params;
    const { videoid, commentbody } = req.body;

    // Validate parent comment ID
    if (
      !parentCommentId ||
      !mongoose.Types.ObjectId.isValid(parentCommentId)
    ) {
      return res.status(400).json({
        message: "Invalid parent comment",
      });
    }

    const trimmedReply = commentbody?.trim();

    const safetyCheck =
      validateCommentSafety(trimmedReply);

    if (!safetyCheck.allowed) {
      return res.status(400).json({
        message: safetyCheck.message,
      });
    }

    if (!videoid || !trimmedReply) {
      return res.status(400).json({
        message: "Reply cannot be empty",
      });
    }

    if (trimmedReply.length > 500) {
      return res.status(400).json({
        message: "Reply cannot exceed 500 characters",
      });
    }

    // Find the actual parent comment
    const parentComment = await comment.findById(
      parentCommentId
    );

    if (!parentComment) {
      return res.status(404).json({
        message: "Parent comment not found",
      });
    }

    // Get authenticated MongoDB user
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Authenticated user not found",
      });
    }

    const duplicateReply =
      await comment.findOne({
        userid: user._id,
        videoid,
        commentbody: trimmedReply,
        parentCommentId: parentCommentId,
      });

    if (duplicateReply) {
      return res.status(409).json({
        message:
          "You have already posted this reply.",
      });
    }

    // Extract @mentions
    const mentions = extractMentions(trimmedReply);

    // Create reply
    const newReply = new comment({
      userid: user._id,
      videoid,
      commentbody: trimmedReply,
      usercommented: user.name,

      // THIS is the important part
      parentCommentId: parentCommentId,

      mentions,
    });

    await newReply.save();



    await commentHistory.create({
      commentId: newReply._id,
      userId: user._id,
      action: "CREATED",
      oldText: "",
      newText: trimmedReply,
    });
    return res.status(201).json({
      comment: true,
      data: newReply,
    });
  } catch (error) {
    console.error(
      "Reply comment error:",
      error
    );

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

export const searchMentionUsers = async (req, res) => {
  try {
    const search = req.query.search || "";

    const usersList = await users
      .find({
        name: {
          $regex: search,
          $options: "i",
        },
      })
      .select("_id name image channelname")
      .limit(6);

    const result = usersList.map((user) => {
      const baseName =
        user.channelname || user.name || "user";

      const username = baseName
        .trim()
        .replace(/\s+/g, "")
        .replace(/[^a-zA-Z0-9_]/g, "");

      return {
        _id: user._id,
        username,
        name: user.name,
        image: user.image,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Mention user search error:",
      error
    );

    return res.status(500).json({
      message: "Unable to search users",
    });
  }
};
export const reportComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason } = req.body;

    const allowedReasons = [
      "spam",
      "harassment",
      "offensive",
      "other",
    ];

    if (
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      return res.status(400).json({
        message: "Invalid comment.",
      });
    }

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        message: "Invalid report reason.",
      });
    }

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Please log in to report comments.",
      });
    }

    const existingComment =
      await comment.findById(commentId);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found.",
      });
    }

    // Prevent users from reporting their own comment
    if (
      existingComment.userid.toString() ===
      user._id.toString()
    ) {
      return res.status(403).json({
        message:
          "You cannot report your own comment.",
      });
    }

    // Duplicate report protection
    const existingReport =
      await commentReport.findOne({
        commentId,
        reporterId: user._id,
      });

    if (existingReport) {
      return res.status(409).json({
        message:
          "You have already reported this comment.",
      });
    }

    const report = await commentReport.create({
      commentId,
      reporterId: user._id,
      reason,
    });

    return res.status(201).json({
      success: true,
      message:
        "Comment reported successfully. It has been flagged for administrator review.",
      data: report,
    });
  } catch (error) {
    console.error(
      "Report comment error:",
      error
    );

    // MongoDB unique index protection
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "You have already reported this comment.",
      });
    }

    return res.status(500).json({
      message:
        "Unable to report comment.",
    });
  }
};

export const getReportedComments = async (req, res) => {
  try {
    const admin = await getAdminUser(req);

    if (!admin) {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const reports = await commentReport
      .find()
      .populate(
        "commentId",
        "commentbody usercommented userid createdAt"
      )
      .populate(
        "reporterId",
        "name username email"
      )
      .populate(
        "reviewedBy",
        "name username"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json(reports);
  } catch (error) {
    console.error("Get reports error:", error);

    return res.status(500).json({
      message: "Unable to load reports.",
    });
  }
};

export const dismissReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const admin = await getAdminUser(req);

    if (!admin) {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const report = await commentReport.findById(
      reportId
    );

    if (!report) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    report.status = "dismissed";
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();

    await report.save();

    await moderationLog.create({
      reportId: report._id,
      commentId: report.commentId,
      adminId: admin._id,
      action: "dismissed",
    });

    return res.status(200).json({
      success: true,
      message: "Report dismissed.",
    });
  } catch (error) {
    console.error("Dismiss report error:", error);

    return res.status(500).json({
      message: "Unable to dismiss report.",
    });
  }
};

export const reviewReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const admin = await getAdminUser(req);

    if (!admin) {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const report = await commentReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    if (report.status !== "pending") {
      return res.status(400).json({
        message: "This report has already been reviewed.",
      });
    }

    report.status = "reviewed";
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();

    await report.save();

    await moderationLog.create({
      reportId: report._id,
      commentId: report.commentId,
      adminId: admin._id,
      action: "reviewed",
    });

    return res.status(200).json({
      success: true,
      message: "Report marked as reviewed.",
    });
  } catch (error) {
    console.error("Review report error:", error);

    return res.status(500).json({
      message: "Unable to review report.",
    });
  }
};

export const deleteReportedComment = async (
  req,
  res
) => {
  try {
    const { reportId } = req.params;

    const admin = await getAdminUser(req);

    if (!admin) {
      return res.status(403).json({
        message: "Admin access required.",
      });
    }

    const report = await commentReport.findById(
      reportId
    );

    if (!report) {
      return res.status(404).json({
        message: "Report not found.",
      });
    }

    const existingComment =
      await comment.findById(report.commentId);

    if (existingComment) {
      await comment.findByIdAndUpdate(
        report.commentId,
        {
          $set: {
            status: "deleted",
            deletedAt: new Date(),
            commentbody: "",
          },
        }
      );

      await commentHistory.create({
        commentId: existingComment._id,
        userId: admin._id,
        action: "DELETED",
        oldText: existingComment.commentbody,
        newText: "",
      });
    }

    report.status = "deleted";
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();

    await report.save();

    await moderationLog.create({
      reportId: report._id,
      commentId: report.commentId,
      adminId: admin._id,
      action: "deleted",
    });

    return res.status(200).json({
      success: true,
      message: "Comment removed by administrator.",
    });
  } catch (error) {
    console.error(
      "Delete reported comment error:",
      error
    );

    return res.status(500).json({
      message: "Unable to remove comment.",
    });
  }
};