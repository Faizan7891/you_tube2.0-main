import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import user from "../Modals/Auth.js";
import video from "../Modals/video.js";
import download from "../Modals/download.js";
import downloadQuota from "../Modals/downloadQuota.js";

const PLAN_LIMITS = {
  free: {
    daily: 1,
    monthly: 30,
  },

  bronze: {
    daily: 3,
    monthly: 90,
  },

  silver: {
    daily: 5,
    monthly: 150,
  },

  gold: {
    daily: 10,
    monthly: 300,
  },
};

const getBrowser = (userAgent) => {
  if (!userAgent) return "unknown";

  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Opera")) return "Opera";

  return "unknown";
};

const getDevice = (userAgent) => {
  if (!userAgent) return "unknown";

  if (/mobile/i.test(userAgent)) {
    return "Mobile";
  }

  if (/tablet/i.test(userAgent)) {
    return "Tablet";
  }

  return "Desktop";
};

const getStartOfDay = () => {
  const date = new Date();

  date.setHours(0, 0, 0, 0);

  return date;
};

const getStartOfMonth = () => {
  const date = new Date();

  date.setDate(1);
  date.setHours(0, 0, 0, 0);

  return date;
};

/*
  Atomically reserve one download from a quota.

  If the quota document does not exist, it is created with used = 0.
  Then one download is reserved only if used < limit.
*/
const reserveQuota = async (
  userId,
  periodType,
  periodStart,
  limit
) => {
  let quota = await downloadQuota.findOne({
    userId,
    periodType,
    periodStart,
  });

  if (!quota) {
    try {
      quota = await downloadQuota.create({
        userId,
        periodType,
        periodStart,
        used: 0,
        limit,
      });
    } catch (error) {
      // Another simultaneous request may have created it.
      if (error.code === 11000) {
        quota = await downloadQuota.findOne({
          userId,
          periodType,
          periodStart,
        });
      } else {
        throw error;
      }
    }
  }

  const updatedQuota = await downloadQuota.findOneAndUpdate(
    {
      _id: quota._id,
      used: {
        $lt: limit,
      },
    },
    {
      $inc: {
        used: 1,
      },
      $set: {
        limit,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedQuota) {
    return null;
  }

  return updatedQuota;
};

/*
  Release a previously reserved quota.

  This is used when a download fails or is interrupted.
*/
const releaseQuota = async (
  userId,
  periodType,
  periodStart
) => {
  await downloadQuota.findOneAndUpdate(
    {
      userId,
      periodType,
      periodStart,
      used: {
        $gt: 0,
      },
    },
    {
      $inc: {
        used: -1,
      },
    }
  );
};

export const downloadVideo = async (req, res) => {
  let downloadRecord = null;

  let dailyReserved = false;
  let monthlyReserved = false;

  let dailyPeriodStart = null;
  let monthlyPeriodStart = null;

  try {
    const { videoId } = req.params;

    // Validate video ID
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({
        message: "Invalid video ID",
      });
    }

    // --------------------------------------------------
    // AUTHENTICATED USER
    // --------------------------------------------------

  const firebaseEmail = req.firebaseUser.email;

const currentUser = await user.findOne({
  email: firebaseEmail,
});

if (!currentUser) {
  return res.status(404).json({
    message: "User not found",
  });
}

const deviceId = req.headers["x-device-id"];

if (!deviceId) {
  return res.status(400).json({
    message: "Device identification is required",
  });
}

// Register first device
if (!currentUser.registeredDeviceId) {
  currentUser.registeredDeviceId = deviceId;
  await currentUser.save();
}

// Allow only registered device
if (currentUser.registeredDeviceId !== deviceId) {
  return res.status(403).json({
    message:
      "Downloads are restricted to your registered device",
  });
}

    // --------------------------------------------------
    // FIND VIDEO
    // --------------------------------------------------

    const selectedVideo = await video.findById(videoId);

    if (!selectedVideo) {
      return res.status(404).json({
        message: "Video not found",
      });
    }

    // --------------------------------------------------
    // CHECK FILE ACCESSIBILITY
    // --------------------------------------------------

    if (
      !selectedVideo.filepath ||
      !fs.existsSync(selectedVideo.filepath)
    ) {
      return res.status(404).json({
        message: "Video file is not available",
      });
    }

    // --------------------------------------------------
    // CHECK SUBSCRIPTION
    // --------------------------------------------------

    let plan = currentUser.subscriptionPlan || "free";

    if (plan !== "free") {
      if (
        !currentUser.subscriptionExpiryDate ||
        new Date(currentUser.subscriptionExpiryDate) <=
        new Date()
      ) {
        plan = "free";

        currentUser.subscriptionPlan = "free";
        currentUser.dailyDownloadLimit = 1;
        currentUser.monthlyDownloadLimit = 30;

        await currentUser.save();
      }
    }

    const limits = PLAN_LIMITS[plan];

    // --------------------------------------------------
    // DUPLICATE DOWNLOAD CHECK
    // --------------------------------------------------

    const duplicatePeriod = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    );

    const recentDuplicate = await download.findOne({
      userId: currentUser._id,

      videoId: selectedVideo._id,

      status: {
        $in: ["pending", "completed"],
      },

      downloadDate: {
        $gte: duplicatePeriod,
      },
    });

    if (recentDuplicate) {
      return res.status(409).json({
        message:
          recentDuplicate.status === "pending"
            ? "This video is already being downloaded"
            : "This video was already downloaded within the last 24 hours",
      });
    }

    // --------------------------------------------------
    // PERIODS
    // --------------------------------------------------

    dailyPeriodStart = getStartOfDay();
    monthlyPeriodStart = getStartOfMonth();

    // --------------------------------------------------
    // RESERVE DAILY QUOTA ATOMICALLY
    // --------------------------------------------------

    const dailyQuota = await reserveQuota(
      currentUser._id,
      "daily",
      dailyPeriodStart,
      limits.daily
    );

    if (!dailyQuota) {
      return res.status(403).json({
        message: "Daily download limit reached",
        remainingDailyQuota: 0,
      });
    }

    dailyReserved = true;

    // --------------------------------------------------
    // RESERVE MONTHLY QUOTA ATOMICALLY
    // --------------------------------------------------

    const monthlyQuota = await reserveQuota(
      currentUser._id,
      "monthly",
      monthlyPeriodStart,
      limits.monthly
    );

    if (!monthlyQuota) {
      // Release daily reservation because monthly quota failed.
      await releaseQuota(
        currentUser._id,
        "daily",
        dailyPeriodStart
      );

      dailyReserved = false;

      return res.status(403).json({
        message: "Monthly download limit reached",
        remainingMonthlyQuota: 0,
      });
    }

    monthlyReserved = true;

    // --------------------------------------------------
    // CREATE AUDIT RECORD
    // --------------------------------------------------

    const userAgent =
      req.headers["user-agent"] || "unknown";

    downloadRecord = await download.create({
      userId: currentUser._id,

      videoId: selectedVideo._id,

      downloadDate: new Date(),

      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress ||
        "unknown",

        deviceId: deviceId,

     deviceInfo: `${getDevice(
  userAgent
)} | Device ID: ${deviceId}`,

      browser: getBrowser(userAgent),

      subscriptionPlan: plan,

      fileSize: selectedVideo.filesize,

      status: "pending",
    });

    // --------------------------------------------------
    // STREAM FILE
    // --------------------------------------------------

    const filePath = path.resolve(
      selectedVideo.filepath
    );

    const fileName =
      selectedVideo.filename || "video.mp4";

    res.download(
      filePath,
      fileName,
      async (error) => {
        if (error) {
          console.error(
            "Download error:",
            error
          );

          // Mark download as failed.
          if (downloadRecord) {
            downloadRecord.status = "failed";

            await downloadRecord.save();
          }

          // Release quota because download failed.
          if (dailyReserved) {
            await releaseQuota(
              currentUser._id,
              "daily",
              dailyPeriodStart
            );

            dailyReserved = false;
          }

          if (monthlyReserved) {
            await releaseQuota(
              currentUser._id,
              "monthly",
              monthlyPeriodStart
            );

            monthlyReserved = false;
          }

          if (!res.headersSent) {
            return res.status(500).json({
              message: "Download failed",
            });
          }

          return;
        }

        // Successful download.
        if (downloadRecord) {
          downloadRecord.status = "completed";

          await downloadRecord.save();
        }

        dailyReserved = false;
        monthlyReserved = false;
      }
    );
  } catch (error) {
    console.error(
      "Download controller error:",
      error
    );

    // Mark failed download.
    if (downloadRecord) {
      downloadRecord.status = "failed";

      try {
        await downloadRecord.save();
      } catch (saveError) {
        console.error(saveError);
      }
    }

    // Release reserved quotas.
    if (dailyReserved && dailyPeriodStart) {
      try {
        await releaseQuota(
          currentUser._id,
          "daily",
          dailyPeriodStart
        );
      } catch (quotaError) {
        console.error(quotaError);
      }
    }

    if (monthlyReserved && monthlyPeriodStart) {
      try {
        await releaseQuota(
          currentUser._id,
          "monthly",
          monthlyPeriodStart
        );
      } catch (quotaError) {
        console.error(quotaError);
      }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          "Something went wrong while processing the download",
      });
    }
  }
};

export const getMyDownloads = async (req, res) => {
  try {
    const currentUser = await user.findOne({
      email: req.firebaseUser.email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    let plan =
      currentUser.subscriptionPlan || "free";

    // Expired paid subscription becomes free.
    if (plan !== "free") {
      if (
        !currentUser.subscriptionExpiryDate ||
        new Date(
          currentUser.subscriptionExpiryDate
        ) <= new Date()
      ) {
        plan = "free";
      }
    }

    const limits = PLAN_LIMITS[plan];

    const startOfDay = getStartOfDay();

    const startOfMonth = getStartOfMonth();

    // Get quota documents.
    const dailyQuota =
      await downloadQuota.findOne({
        userId: currentUser._id,
        periodType: "daily",
        periodStart: startOfDay,
      });

    const monthlyQuota =
      await downloadQuota.findOne({
        userId: currentUser._id,
        periodType: "monthly",
        periodStart: startOfMonth,
      });

    const dailyUsed =
      dailyQuota?.used || 0;

    const monthlyUsed =
      monthlyQuota?.used || 0;

    const downloads =
      await download
        .find({
          userId: currentUser._id,
        })
        .populate(
          "videoId",
          "videotitle filename filesize filepath thumbnail"
        )
        .sort({
          downloadDate: -1,
        });

    return res.status(200).json({
      downloads,

      subscriptionPlan: plan,

      dailyDownloadLimit:
        limits.daily,

      monthlyDownloadLimit:
        limits.monthly,

      remainingDailyQuota: Math.max(
        limits.daily - dailyUsed,
        0
      ),

      remainingMonthlyQuota: Math.max(
        limits.monthly - monthlyUsed,
        0
      ),
    });
  } catch (error) {
    console.error(
      "Get downloads error:",
      error
    );

    return res.status(500).json({
      message: "Unable to fetch downloads",
    });
  }
};


