import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js";
import videoroutes from "./routes/video.js";
import likeroutes from "./routes/like.js";
import watchlaterroutes from "./routes/watchlater.js";
import historyrroutes from "./routes/history.js";
import commentroutes from "./routes/comment.js";
import commentReactionRoutes from "./routes/commentReaction.js";
import dns from "dns";
import translationRoutes from "./routes/translation.js";
import captchaRoutes from "./routes/captcha.js";
import downloadRoutes from "./routes/download.js";
import securityRoutes from "./routes/security.js";
import subscriptionRoutes from "./routes/subscription.js";
import {
  processExpiredSubscriptions,  
} from "./controllers/subscription.js";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
  
dotenv.config();
const app = express();
import path from "path";
app.use(cors());
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use("/uploads", express.static(path.join("uploads")));
app.get("/", (req, res) => {
  res.send("You tube backend is working");
});
app.use(bodyParser.json());
app.use("/user", userroutes);
app.use("/video", videoroutes);
app.use("/like", likeroutes);
app.use("/watch", watchlaterroutes);
app.use("/history", historyrroutes);
app.use("/comment", commentroutes);
app.use("/comment-reaction", commentReactionRoutes);
app.use("/translation", translationRoutes);
app.use("/captcha", captchaRoutes);
app.use("/download", downloadRoutes);
app.use(
  "/subscription",
  subscriptionRoutes
);
app.use(
  "/security",
  securityRoutes
);
app.use("/uploads", express.static("uploads"));
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});

const DBURL = process.env.DB_URL;
mongoose
  .connect(DBURL)
  .then(() => {
    console.log("Mongodb connected");

    // Check expired subscriptions immediately
    processExpiredSubscriptions();

    // Check every hour
    setInterval(() => {
      processExpiredSubscriptions();
    }, 60 * 60 * 1000);
  })
  .catch((error) => {
    console.log(error);
  });

