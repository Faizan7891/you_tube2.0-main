import mongoose from "mongoose";
import CommentReaction from "../Modals/CommentReaction.js";
import users from "../Modals/Auth.js";
import comment from "../Modals/comment.js";

// Get authenticated MongoDB user
const getAuthenticatedUser = async (req) => {
  const firebaseEmail = req.firebaseUser?.email;

  if (!firebaseEmail) {
    return null;
  }

  return await users.findOne({ email: firebaseEmail });
};

// LIKE / DISLIKE COMMENT
export const reactToComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        message: "Invalid comment ID",
      });
    }

    if (!["like", "dislike"].includes(type)) {
      return res.status(400).json({
        message: "Reaction must be like or dislike",
      });
    }

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        message: "Authenticated user not found",
      });
    }

    const existingComment = await comment.findById(commentId);

    if (!existingComment) {
      return res.status(404).json({
        message: "Comment not found",
      });
    }

    const existingReaction = await CommentReaction.findOne({
      userId: user._id,
      commentId,
    });

    // No previous reaction
    if (!existingReaction) {
      await CommentReaction.create({
        userId: user._id,
        commentId,
        type,
      });

      return res.status(200).json({
        message: "Reaction added",
        reaction: type,
      });
    }

    // Same reaction → remove it
    if (existingReaction.type === type) {
      await CommentReaction.findByIdAndDelete(existingReaction._id);

      return res.status(200).json({
        message: "Reaction removed",
        reaction: null,
      });
    }

    // Like → Dislike OR Dislike → Like
    existingReaction.type = type;
    await existingReaction.save();

    return res.status(200).json({
      message: "Reaction changed",
      reaction: type,
    });
  } catch (error) {
    console.error("Comment reaction error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// GET REACTION COUNTS
export const getCommentReactions = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        message: "Invalid comment ID",
      });
    }

    const likes = await CommentReaction.countDocuments({
      commentId,
      type: "like",
    });

    const dislikes = await CommentReaction.countDocuments({
      commentId,
      type: "dislike",
    });

    const user = await getAuthenticatedUser(req);

    let userReaction = null;

    if (user) {
      const reaction = await CommentReaction.findOne({
        userId: user._id,
        commentId,
      });

      if (reaction) {
        userReaction = reaction.type;
      }
    }

    return res.status(200).json({
      likes,
      dislikes,
      userReaction,
    });
  } catch (error) {
    console.error("Get reaction error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};