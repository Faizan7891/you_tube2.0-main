import users from "../Modals/Auth.js";
import LoginHistory from "../Modals/LoginHistory.js";

export const getSecurityInfo = async (req, res) => {
  try {
    const email = req.firebaseUser.email;

    const currentUser = await users.findOne({
      email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const loginHistory = await LoginHistory.find({
      userId: currentUser._id,
    })
      .sort({ loginTimestamp: -1 })
      .limit(50);

    return res.status(200).json({
      loginHistory,
      trustedDevices:
        currentUser.trustedDevices || [],
    });
  } catch (error) {
    console.error(
      "Security info error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to fetch security information",
    });
  }
};

export const revokeTrustedDevice = async (
  req,
  res
) => {
  try {
    const email = req.firebaseUser.email;
    const { deviceId } = req.params;

    const currentUser = await users.findOne({
      email,
    });

    if (!currentUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    currentUser.trustedDevices =
      (currentUser.trustedDevices || []).filter(
        (device) =>
          device.deviceId !== deviceId
      );

    await currentUser.save();

    return res.status(200).json({
      message:
        "Trusted device removed successfully",
    });
  } catch (error) {
    console.error(
      "Revoke device error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to remove trusted device",
    });
  }
};