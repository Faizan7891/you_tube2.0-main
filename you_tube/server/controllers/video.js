import video from "../Modals/video.js";

export const uploadvideo = async (req, res) => {
 if (!req.files?.file?.[0]) {
    return res
      .status(404)
      .json({ message: "plz upload a mp4 video file only" });
  } else {
    try {
    const videoFile = req.files.file[0];
const thumbnailFile = req.files.thumbnail?.[0];

const file = new video({
  videotitle: req.body.videotitle,
  filename: videoFile.originalname,
  filepath: videoFile.path,
  filetype: videoFile.mimetype,
  filesize: videoFile.size,
 thumbnail: thumbnailFile
  ? `/uploads/${thumbnailFile.filename}`
  : "",
  videochanel: req.body.videochanel,
  uploader: req.body.uploader,
});
      await file.save();
      return res.status(201).json("file uploaded successfully");
    } catch (error) {
      console.error(" error:", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  }
};
export const getallvideo = async (req, res) => {
  try {
    const files = await video.find();
    return res.status(200).send(files);
  } catch (error) {
    console.error(" error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
