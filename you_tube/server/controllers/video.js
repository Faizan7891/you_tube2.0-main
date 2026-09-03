import video from "../Modals/video.js";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// =========================================================
// GENERATE THUMBNAIL
// =========================================================

const generateThumbnail = (videoPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      videoPath,
      "-ss",
      "00:00:01",
      "-frames:v",
      "1",
      "-q:v",
      "2",
      thumbnailPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`FFmpeg exited with code ${code}`)
        );
      }
    });

    ffmpeg.on("error", reject);
  });
};

// =========================================================
// 6.2 - GENERATE VIDEO QUALITY
// =========================================================

const generateQuality = (
  inputPath,
  outputPath,
  height
) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      inputPath,

      "-vf",
      `scale=-2:${height}`,

      "-c:v",
      "libx264",

      "-preset",
      "veryfast",

      "-crf",
      "23",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-movflags",
      "+faststart",

      "-y",

      outputPath,
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg ${height}p exited with code ${code}`
          )
        );
      }
    });

    ffmpeg.on("error", reject);
  });
};

// =========================================================
// 6.3 - GENERATE TIMELINE PREVIEW FRAMES
// =========================================================

const generatePreviewFrames = (
  videoPath,
  previewDirectory
) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-i",
      videoPath,

      "-vf",
      "fps=1/10,scale=240:-2",

      "-q:v",
      "5",

      path.join(
        previewDirectory,
        "preview-%03d.jpg"
      ),
    ]);

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Preview generation failed with code ${code}`
          )
        );
      }
    });

    ffmpeg.on("error", reject);
  });
};

// =========================================================
// UPLOAD VIDEO
// =========================================================

export const uploadvideo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Please upload an MP4 video file.",
    });
  }

  try {
    const videoFile = req.file;

    // =====================================================
    // CREATE PREVIEW DIRECTORY
    // =====================================================

    const previewDirectory = path.join(
      "uploads",
      `previews-${Date.now()}`
    );

    fs.mkdirSync(previewDirectory, {
      recursive: true,
    });

    // =====================================================
    // ORIGINAL VIDEO NAME
    // =====================================================

    const baseName = path.parse(
      videoFile.filename
    ).name;

    // =====================================================
    // GENERATE THUMBNAIL
    // =====================================================

    const thumbnailFilename =
      `thumbnail-${Date.now()}.jpg`;

    const thumbnailPath = path.join(
      "uploads",
      thumbnailFilename
    );

    console.log("Generating thumbnail...");

    await generateThumbnail(
      videoFile.path,
      thumbnailPath
    );

    console.log(
      "Thumbnail generated successfully"
    );

    // =====================================================
    // QUALITY FILE NAMES
    // =====================================================

    const quality360Filename =
      `${baseName}-360p.mp4`;

    const quality480Filename =
      `${baseName}-480p.mp4`;

    const quality720Filename =
      `${baseName}-720p.mp4`;

    // =====================================================
    // QUALITY FILE PATHS
    // =====================================================

    const quality360Path = path.join(
      "uploads",
      quality360Filename
    );

    const quality480Path = path.join(
      "uploads",
      quality480Filename
    );

    const quality720Path = path.join(
      "uploads",
      quality720Filename
    );

    // =====================================================
    // GENERATE 360p
    // =====================================================

    console.log(
      "Generating 360p video..."
    );

    await generateQuality(
      videoFile.path,
      quality360Path,
      360
    );

    console.log(
      "360p generated successfully"
    );

    // =====================================================
    // GENERATE 480p
    // =====================================================

    console.log(
      "Generating 480p video..."
    );

    await generateQuality(
      videoFile.path,
      quality480Path,
      480
    );

    console.log(
      "480p generated successfully"
    );

    // =====================================================
    // GENERATE 720p
    // =====================================================

    console.log(
      "Generating 720p video..."
    );

    await generateQuality(
      videoFile.path,
      quality720Path,
      720
    );

    console.log(
      "720p generated successfully"
    );

    // =====================================================
    // 6.3 - GENERATE TIMELINE PREVIEW FRAMES
    // =====================================================

    console.log(
      "Generating timeline preview frames..."
    );

    await generatePreviewFrames(
      videoFile.path,
      previewDirectory
    );

    console.log(
      "Timeline preview frames generated successfully"
    );

    // =====================================================
    // PREVIEW DIRECTORY URL
    // =====================================================

    const previewDirectoryUrl =
      `/uploads/${path.basename(
        previewDirectory
      )}`;

    // =====================================================
    // SAVE VIDEO IN MONGODB
    // =====================================================

    const file = new video({
      videotitle:
        req.body.videotitle,

      filename:
        videoFile.originalname,

      filepath:
        videoFile.path,

      filetype:
        videoFile.mimetype,

      filesize:
        videoFile.size,

      thumbnail:
        `/uploads/${thumbnailFilename}`,

      // ===================================================
      // 6.1 - SUBTITLES
      // ===================================================

      subtitles: [],

      previewFrames: {
  directory: `/uploads/${path.basename(previewDirectory)}`,
  interval: 10,
},

      // ===================================================
      // 6.2 - VIDEO QUALITIES
      // ===================================================

      qualities: [
        {
          label: "360p",
          src: `/uploads/${quality360Filename}`,
          height: 360,
          width: 640,
        },

        {
          label: "480p",
          src: `/uploads/${quality480Filename}`,
          height: 480,
          width: 854,
        },

        {
          label: "720p",
          src: `/uploads/${quality720Filename}`,
          height: 720,
          width: 1280,
        },
      ],

      // ===================================================
      // 6.3 - TIMELINE PREVIEW
      // ===================================================

      previewFrames: {
        directory: previewDirectoryUrl,
        interval: 10,
      },

      // ===================================================
      // OTHER VIDEO DATA
      // ===================================================

      videochanel:
        req.body.videochanel,

      uploader:
        req.body.uploader,
    });

    await file.save();

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(201).json({
      message:
        "Video uploaded successfully",

      thumbnail:
        `/uploads/${thumbnailFilename}`,

      qualities: [
        {
          label: "360p",
          src: `/uploads/${quality360Filename}`,
        },

        {
          label: "480p",
          src: `/uploads/${quality480Filename}`,
        },

        {
          label: "720p",
          src: `/uploads/${quality720Filename}`,
        },
      ],

      previewFrames: {
        directory: previewDirectoryUrl,
        interval: 10,
      },
    });
  } catch (error) {
    console.error(
      "Video upload error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong while uploading video.",
    });
  }
};

// =========================================================
// GET ALL VIDEOS
// =========================================================

export const getallvideo = async (req, res) => {
  try {
    const files = await video.find();

    return res.status(200).send(files);
  } catch (error) {
    console.error(
      "Error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong",
    });
  }
};