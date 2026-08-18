import mongoose from "mongoose";

const commentschema = mongoose.Schema(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    videoid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "videofiles",
      required: true,
    },

    // Null = normal/top-level comment
    // ID = reply to another comment
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "comment",
      default: null,
    },

    commentbody: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    usercommented: {
      type: String,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    editVersion: {
      type: Number,
      default: 0,
    },
    status: {
  type: String,
  enum: ["active", "deleted"],
  default: "active",
},

deletedAt: {
  type: Date,
  default: null,
},
    mentions: {
      type: [String],
      default: [],
    },

    commentedon: {
      type: Date,
      default: Date.now,
    },
  },

  {
    timestamps: true,
  }
);

export default mongoose.models.comment ||
  mongoose.model("comment", commentschema);