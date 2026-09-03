import mongoose from "mongoose";

const videochema = mongoose.Schema(
  {
    videotitle: {
      type: String,
      required: true,
    },

    filename: {
      type: String,
      required: true,
    },

    filetype: {
      type: String,
      required: true,
    },

    filepath: {
      type: String,
      required: true,
    },

    filesize: {
      type: String,
      required: true,
    },

    thumbnail: {
      type: String,
      default: "",
    },

    // =========================================================
    // 6.1 - SUBTITLES / CAPTIONS
    // =========================================================

    subtitles: [
      {
        label: {
          type: String,
          required: true,
        },

        language: {
          type: String,
          required: true,
        },

        src: {
          type: String,
          required: true,
        },

        kind: {
          type: String,
          default: "captions",
        },

        default: {
          type: Boolean,
          default: false,
        },
      },
    ],
    // =========================================================
// 6.3 - TIMELINE PREVIEW FRAMES
// =========================================================

previewFrames: {
  directory: {
    type: String,
    default: "",
  },

  interval: {
    type: Number,
    default: 10,
  },
},

qualities: [
  {
    label: {
      type: String,
      required: true,
    },

    src: {
      type: String,
      required: true,
    },

    height: {
      type: Number,
      default: 0,
    },

    width: {
      type: Number,
      default: 0,
    },
  },
],

    videochanel: {
      type: String,
      required: true,
    },

    Like: {
      type: Number,
      default: 0,
    },

    views: {
      type: Number,
      default: 0,
    },

    uploader: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("videofiles", videochema);