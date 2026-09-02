import express from "express";
import { getallvideo, uploadvideo } from "../controllers/video.js";
import upload from "../filehelper/filehelper.js";

const routes = express.Router();

routes.post(
  "/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  uploadvideo
);routes.get("/getall", getallvideo);
export default routes;
