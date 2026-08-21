export const getLocationFromIp = async (ipAddress) => {
  try {
    if (
      !ipAddress ||
      ipAddress === "unknown" ||
      ipAddress === "::1" ||
      ipAddress === "127.0.0.1"
    ) {
      return {
        city: "Localhost",
        state: "Unknown",
        country: "Unknown",
        latitude: null,
        longitude: null,
        location: "Local development",
      };
    }

    const response = await fetch(
      `https://ipapi.co/${ipAddress}/json/`
    );

    if (!response.ok) {
      throw new Error(
        "Unable to fetch IP location"
      );
    }

    const data = await response.json();

    return {
      city: data.city || "Unknown",

      state:
        data.region || "Unknown",

      country:
        data.country_name || "Unknown",

      latitude:
        data.latitude
          ? Number(data.latitude)
          : null,

      longitude:
        data.longitude
          ? Number(data.longitude)
          : null,

      location: [
        data.city,
        data.region,
        data.country_name,
      ]
        .filter(Boolean)
        .join(", "),
    };
  } catch (error) {
    console.error(
      "IP location error:",
      error
    );

    return {
      city: "Unknown",
      state: "Unknown",
      country: "Unknown",
      latitude: null,
      longitude: null,
      location: "Unknown",
    };
  }
};