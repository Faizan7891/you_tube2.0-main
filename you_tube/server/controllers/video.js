import video from "../Modals/video.js";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import path from "path";

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

export const uploadvideo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: "Please upload an MP4 video file.",
    });
  }

  try {
    const videoFile = req.file;

    const thumbnailFilename =
      `thumbnail-${Date.now()}.jpg`;

    const thumbnailPath = path.join(
      "uploads",
      thumbnailFilename
    );

    await generateThumbnail(
      videoFile.path,
      thumbnailPath
    );

    const file = new video({
      videotitle: req.body.videotitle,
      filename: videoFile.originalname,
      filepath: videoFile.path,
      filetype: videoFile.mimetype,
      filesize: videoFile.size,

      thumbnail: `/uploads/${thumbnailFilename}`,

      videochanel: req.body.videochanel,
      uploader: req.body.uploader,
    });

    await file.save();

    return res.status(201).json({
      message: "Video uploaded successfully",
      thumbnail: `/uploads/${thumbnailFilename}`,
    });
  } catch (error) {
    console.error("Video upload error:", error);

    return res.status(500).json({
      message: "Something went wrong while uploading video.",
    });
  }
};

export const getallvideo = async (req, res) => {
  try {
    const files = await video.find();

    return res.status(200).send(files);
  } catch (error) {
    console.error("Error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};