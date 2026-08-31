import mongoose from "mongoose";
import users from "../Modals/Auth.js";
import {
  getLoginDeviceInfo,
  getLoginTheme,
} from "../utils/loginSecurity.js";

import LoginHistory from "../Modals/LoginHistory.js";

import crypto from "crypto";

import {
  sendLoginOTPEmail,
} from "../utils/email.js";
import {
  getLocationFromIp,
} from "../utils/location.js";

export const login = async (req, res) => {
  const { email, name, image } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Detect current login source
    const deviceInfo = getLoginDeviceInfo(req);

    const locationInfo = await getLocationFromIp(
      deviceInfo.ipAddress
    );

    // Automatic theme based on IST login time
    const automaticTheme = getLoginTheme();

    let existingUser = await users.findOne({ email });

    // ==================================================
    // NEW USER
    // ==================================================

    if (!existingUser) {
      existingUser = await users.create({
        email,
        name,
        image,
        theme: automaticTheme,
      });

      await LoginHistory.create({
        userId: existingUser._id,

        ipAddress: deviceInfo.ipAddress,
        browser: deviceInfo.browser,
        browserVersion: deviceInfo.browserVersion,
        operatingSystem: deviceInfo.operatingSystem,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,

        loginTimestamp: new Date(),

        status: "success",

        otpRequired: false,
        otpVerified: false,

        deviceId: deviceInfo.deviceId,
        trustedDevice: false,

        city: locationInfo.city,
        state: locationInfo.state,
        country: locationInfo.country,
        latitude: locationInfo.latitude,
        longitude: locationInfo.longitude,
        location: locationInfo.location,
      });

      return res.status(201).json({
        result: existingUser,
        otpRequired: false,
      });
    }

    // ==================================================
    // REMOVE EXPIRED TRUSTED DEVICES
    // ==================================================

    const now = new Date();

    existingUser.trustedDevices =
      (existingUser.trustedDevices || []).filter(
        (device) =>
          device.trustedUntil &&
          new Date(device.trustedUntil) > now
      );

    // ==================================================
    // CHECK TRUSTED LOGIN SOURCE
    // ==================================================

  const trustedDevice =
  existingUser.trustedDevices?.find(
    (device) => {
      const sameDevice =
        device.deviceId ===
        deviceInfo.deviceId;

      const sameBrowser =
        device.browser ===
        deviceInfo.browser;

      const sameDeviceType =
        device.deviceType ===
        deviceInfo.deviceType;

      const sameIP =
        device.ipAddress ===
        deviceInfo.ipAddress;

      const stillTrusted =
        device.trustedUntil &&
        new Date(device.trustedUntil) >
          new Date();

      return (
        sameDevice &&
        sameBrowser &&
        sameDeviceType &&
        sameIP &&
        stillTrusted
      );
    }
  );

const isNewDevice =
  !trustedDevice;

  console.log(
  "========== LOGIN DEBUG =========="
);

console.log(
  "Browser:",
  deviceInfo.browser
);

console.log(
  "Browser Version:",
  deviceInfo.browserVersion
);

console.log(
  "Device ID:",
  deviceInfo.deviceId
);

console.log(
  "IP:",
  deviceInfo.ipAddress
);

console.log(
  "Trusted Device:",
  trustedDevice
);

console.log(
  "OTP Required:",
  isNewDevice
);

console.log(
  "================================="
);

    // ==================================================
    // DETERMINE WHETHER OTP IS REQUIRED
    // ==================================================

    const otpRequired =
      !trustedDevice;

    // Save current theme only if profile has no manual
    // preference yet.
    if (!existingUser.theme) {
      existingUser.theme = automaticTheme;
    }

    await existingUser.save();

    // ==================================================
    // NEW / UNTRUSTED LOGIN
    // ==================================================

    if (otpRequired) {
      const loginRecord =
        await LoginHistory.create({
          userId: existingUser._id,

          ipAddress: deviceInfo.ipAddress,
          browser: deviceInfo.browser,
          browserVersion:
            deviceInfo.browserVersion,
          operatingSystem:
            deviceInfo.operatingSystem,
          deviceType: deviceInfo.deviceType,
          deviceModel: deviceInfo.deviceModel,

          loginTimestamp: new Date(),

          status: "otp_required",

          otpRequired: true,
          otpVerified: false,

          deviceId: deviceInfo.deviceId,

          trustedDevice: false,

          city: locationInfo.city,
          state: locationInfo.state,
          country: locationInfo.country,
          latitude: locationInfo.latitude,
          longitude: locationInfo.longitude,
          location: locationInfo.location,
        });

      return res.status(200).json({
        result: existingUser,

        otpRequired: true,

        loginId: loginRecord._id,

        deviceInfo: {
          browser: deviceInfo.browser,
          browserVersion:
            deviceInfo.browserVersion,
          operatingSystem:
            deviceInfo.operatingSystem,
          deviceType:
            deviceInfo.deviceType,
          deviceModel:
            deviceInfo.deviceModel,
          ipAddress:
            deviceInfo.ipAddress,
          location:
            locationInfo.location,
        },
      });
    }

    // ==================================================
    // TRUSTED LOGIN
    // ==================================================

    await LoginHistory.create({
      userId: existingUser._id,

      ipAddress: deviceInfo.ipAddress,
      browser: deviceInfo.browser,
      browserVersion:
        deviceInfo.browserVersion,
      operatingSystem:
        deviceInfo.operatingSystem,
      deviceType: deviceInfo.deviceType,
      deviceModel: deviceInfo.deviceModel,

      loginTimestamp: new Date(),

      status: "success",

      otpRequired: false,
      otpVerified: true,

      deviceId: deviceInfo.deviceId,

      trustedDevice: true,

      trustedUntil:
        trustedDevice.trustedUntil,

      city: locationInfo.city,
      state: locationInfo.state,
      country: locationInfo.country,
      latitude: locationInfo.latitude,
      longitude: locationInfo.longitude,
      location: locationInfo.location,
    });

    return res.status(200).json({
      result: existingUser,
      otpRequired: false,
    });
  } catch (error) {
    console.error(
      "Login security error:",
      error
    );

    return res.status(500).json({
      message:
        "Something went wrong during login",
    });
  }
};

export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { channelname, description } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(500).json({ message: "User unavailable..." });
  }
  try {
    const updatedata = await users.findByIdAndUpdate(
      _id,
      {
        $set: {
          channelname: channelname,
          description: description,
        },
      },
      { new: true }
    );
    return res.status(201).json(updatedata);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const sendLoginOTP = async (req, res) => {
  try {
    const { email, loginId } = req.body;

    if (!email || !loginId) {
      return res.status(400).json({
        message: "Email and login ID are required",
      });
    }

    const existingUser = await users.findOne({
      email,
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Generate 6-digit OTP
    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    // OTP valid for 10 minutes
    const expiresAt = Date.now() + 10 * 60 * 1000;

    existingUser.otpCode = otp;
    existingUser.otpExpiresAt = new Date(expiresAt);
    existingUser.otpAttempts = 0;
    existingUser.otpVerified = false;

    await existingUser.save();

    console.log("OTP:", otp);
    console.log(
      "OTP expires:",
      new Date(expiresAt).toString()
    );
    console.log(
      "Current time:",
      new Date().toString()
    );

    await sendLoginOTPEmail({
      email,
      otp,
    });

    return res.status(200).json({
      message: "OTP sent successfully",
    });
  } catch (error) {
    console.error(
      "Send login OTP error:",
      error
    );

    return res.status(500).json({
      message: "Unable to send login OTP",
    });
  }
};

export const verifyLoginOTP = async (req, res) => {
  try {
    const {
      email,
      otp,
      loginId,
      rememberDevice,
    } = req.body;

    if (!email || !otp || !loginId) {
      return res.status(400).json({
        message:
          "Email, OTP and login ID are required",
      });
    }

    const existingUser = await users.findOne({
      email,
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Maximum 5 attempts
    if (existingUser.otpAttempts >= 5) {
      return res.status(429).json({
        message:
          "Too many failed OTP attempts. Please request a new OTP.",
      });
    }

    console.log(
      "Stored OTP:",
      existingUser.otpCode
    );

    console.log(
      "Stored expiry:",
      existingUser.otpExpiresAt
    );

    console.log(
      "Current time:",
      new Date()
    );

    // Check OTP expiry
    if (
      !existingUser.otpExpiresAt ||
      Date.now() >=
      new Date(
        existingUser.otpExpiresAt
      ).getTime()
    ) {
      return res.status(400).json({
        message:
          "OTP has expired. Please request a new OTP.",
      });
    }

    // Check OTP
    if (
      existingUser.otpCode !==
      otp.toString()
    ) {
      existingUser.otpAttempts += 1;

      await existingUser.save();

      return res.status(400).json({
        message: "Invalid OTP",
        remainingAttempts:
          5 - existingUser.otpAttempts,
      });
    }

    // OTP successful
    existingUser.otpCode = null;
    existingUser.otpExpiresAt = null;
    existingUser.otpAttempts = 0;
    existingUser.otpVerified = true;

    // Device information
    const deviceInfo =
      getLoginDeviceInfo(req);

    let trustedUntil = null;

    if (rememberDevice) {
      trustedUntil = new Date(
        Date.now() +
        30 * 24 * 60 * 60 * 1000
      );

      existingUser.trustedDevices =
        existingUser.trustedDevices || [];

      // Remove old record for same device
      existingUser.trustedDevices =
        existingUser.trustedDevices.filter(
          (device) =>
            device.deviceId !==
            deviceInfo.deviceId
        );

      existingUser.trustedDevices.push({
        deviceId:
          deviceInfo.deviceId,

        browser:
          deviceInfo.browser,

        deviceType:
          deviceInfo.deviceType,

        ipAddress:
          deviceInfo.ipAddress,

        trustedUntil,
      });
    }

    await existingUser.save();

    await LoginHistory.findByIdAndUpdate(
      loginId,
      {
        status: "otp_verified",
        otpRequired: true,
        otpVerified: true,
        trustedDevice:
          !!rememberDevice,
        trustedUntil,
      },
      { new: true }
    );

    return res.status(200).json({
      message:
        "OTP verified successfully",

      result: existingUser,

      authenticated: true,

      trustedDevice:
        !!rememberDevice,
    });
  } catch (error) {
    console.error(
      "Verify login OTP error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify OTP",
    });
  }
};