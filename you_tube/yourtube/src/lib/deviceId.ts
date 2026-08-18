export const getDeviceId = (): string => {
  const storageKey = "youtube_download_device_id";

  let deviceId = localStorage.getItem(storageKey);

  if (!deviceId) {
    deviceId =
      crypto.randomUUID();

    localStorage.setItem(
      storageKey,
      deviceId
    );
  }

  return deviceId;
};