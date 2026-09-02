import video from "../Modals/video.js";
import history from "../Modals/history.js";

// =====================================================
// CREATE HISTORY / INITIAL VIEW
// =====================================================

export const handlehistory = async (req, res) => {
  const { userId } = req.body;
  const { videoId } = req.params;

  try {
    const existingHistory = await history.findOne({
      viewer: userId,
      videoid: videoId,
    });

    if (!existingHistory) {
      await history.create({
        viewer: userId,
        videoid: videoId,
      });

      await video.findByIdAndUpdate(videoId, {
        $inc: { views: 1 },
      });
    }

    return res.status(200).json({
      history: true,
    });
  } catch (error) {
    console.error("History error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// =====================================================
// INCREMENT VIEW
// =====================================================

export const handleview = async (req, res) => {
  const { videoId } = req.params;

  try {
    await video.findByIdAndUpdate(videoId, {
      $inc: { views: 1 },
    });

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("View error:", error);

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};

// =====================================================
// SAVE WATCH PROGRESS
// =====================================================

export const saveWatchProgress = async (req, res) => {
  const { videoId } = req.params;

  const {
    userId,
    watchPosition,
    videoDuration,
  } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    if (!videoId) {
      return res.status(400).json({
        message: "Video ID is required",
      });
    }

    const position = Number(watchPosition) || 0;
    const duration = Number(videoDuration) || 0;

    let percentage = 0;

    if (duration > 0) {
      percentage = Math.min(
        100,
        Math.max(
          0,
          (position / duration) * 100
        )
      );
    }

    const completed = percentage >= 90;

    const updatedHistory =
      await history.findOneAndUpdate(
        {
          viewer: userId,
          videoid: videoId,
        },
        {
          $set: {
            watchPosition: position,
            videoDuration: duration,
            watchPercentage: percentage,
            completed,
          },
        },
        {
          new: true,
          upsert: true,
        }
      );

    return res.status(200).json({
      success: true,
      watchPosition: updatedHistory.watchPosition,
      watchPercentage:
        updatedHistory.watchPercentage,
      completed:
        updatedHistory.completed,
    });
  } catch (error) {
    console.error(
      "Save watch progress error:",
      error
    );

    return res.status(500).json({
      message: "Unable to save watch progress",
    });
  }
};

// =====================================================
// GET WATCH PROGRESS
// =====================================================

export const getWatchProgress = async (
  req,
  res
) => {
  const { videoId } = req.params;
  const { userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const watchHistory =
      await history.findOne({
        viewer: userId,
        videoid: videoId,
      });

    if (!watchHistory) {
      return res.status(200).json({
        watchPosition: 0,
        watchPercentage: 0,
        completed: false,
      });
    }

    return res.status(200).json({
      watchPosition:
        watchHistory.watchPosition || 0,

      watchPercentage:
        watchHistory.watchPercentage || 0,

      completed:
        watchHistory.completed || false,
    });
  } catch (error) {
    console.error(
      "Get watch progress error:",
      error
    );

    return res.status(500).json({
      message: "Unable to get watch progress",
    });
  }
};

// =====================================================
// GET ALL HISTORY
// =====================================================

export const getallhistoryVideo = async (
  req,
  res
) => {
  const { userId } = req.params;

  try {
    const historyvideo = await history
      .find({
        viewer: userId,
      })
      .populate({
        path: "videoid",
        model: "videofiles",
      })
      .sort({
        updatedAt: -1,
      })
      .exec();

    return res.status(200).json(historyvideo);
  } catch (error) {
    console.error(
      "History fetch error:",
      error
    );

    return res.status(500).json({
      message: "Something went wrong",
    });
  }
};