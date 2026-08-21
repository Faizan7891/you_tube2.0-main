import crypto from "crypto";
import { UAParser } from "ua-parser-js";

export const getClientIp = (req) => {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

export const getLoginDeviceInfo = (req) => {
  // Get user-agent FIRST
  const userAgent =
    req.headers["user-agent"] || "";

  // Parse user-agent
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const browser =
    result.browser?.name || "unknown";

  const browserVersion =
    result.browser?.version || "unknown";

  const operatingSystem =
    result.os?.name || "unknown";

  let deviceTypeName = "Desktop";

  if (result.device?.type === "mobile") {
    deviceTypeName = "Mobile";
  } else if (
    result.device?.type === "tablet"
  ) {
    deviceTypeName = "Tablet";
  }

  const deviceModel =
    result.device?.model || "unknown";

  const ipAddress =
    getClientIp(req);

  const deviceId = crypto
    .createHash("sha256")
    .update(
      `${userAgent}|${ipAddress}`
    )
    .digest("hex");

  return {
    ipAddress,
    browser,
    browserVersion,
    operatingSystem,
    deviceType: deviceTypeName,
    deviceModel,
    deviceId,
  };
};

export const getLoginTheme = () => {
  const now = new Date();

  const parts =
    new Intl.DateTimeFormat(
      "en-IN",
      {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).formatToParts(now);

  const hour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value
  );

  // 5:00 AM to 11:59 AM IST
  if (hour >= 5 && hour < 12) {
    return "light";
  }

  return "dark";
};