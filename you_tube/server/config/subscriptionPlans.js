export const SUBSCRIPTION_PLANS = {
  free: {
    name: "Free",
    monthly: 0,
    quarterly: 0,
    yearly: 0,

    dailyDownloads: 1,

    streamingQuality: "480p",

    features: [
      "Limited premium videos",
      "480p streaming",
      "Restricted watch time",
      "1 download per day",
    ],
  },

  bronze: {
    name: "Bronze",
    monthly: 199,
    quarterly: 499,
    yearly: 1799,

    dailyDownloads: 3,

    streamingQuality: "720p",

    features: [
      "More video access",
      "720p streaming",
      "Offline downloads",
      "Priority content access",
      "3 downloads per day",
    ],
  },

  silver: {
    name: "Silver",
    monthly: 399,
    quarterly: 999,
    yearly: 3499,

    dailyDownloads: 5,

    streamingQuality: "1080p",

    features: [
      "Unlimited video access",
      "1080p streaming",
      "Offline downloads",
      "Priority content access",
      "Premium courses",
      "Ad-free viewing",
      "5 downloads per day",
    ],
  },

  gold: {
    name: "Gold",
    monthly: 699,
    quarterly: 1799,
    yearly: 5999,

    dailyDownloads: 10,

    streamingQuality: "4K",

    features: [
      "Unlimited video access",
      "4K streaming",
      "Offline downloads",
      "Priority content access",
      "Exclusive premium courses",
      "Ad-free viewing",
      "Faster streaming",
      "10 downloads per day",
    ],
  },
};