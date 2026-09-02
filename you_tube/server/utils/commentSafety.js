// server/utils/commentSafety.js

const PROFANITY_WORDS = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "idiot",
  "stupid",
  "dumbass",
];

const normalizeText = (text = "") => {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

// ================================
// PROFANITY
// ================================
export const containsProfanity = (text) => {
  const normalized = normalizeText(text);

  return PROFANITY_WORDS.some((word) => {
    const regex = new RegExp(
      `(^|\\s)${word}(\\s|$)`,
      "i"
    );

    return regex.test(normalized);
  });
};

// ================================
// URL / LINK PROTECTION
// ================================
export const containsSuspiciousLink = (text) => {
  const suspiciousPatterns = [
    /https?:\/\/\S+/i,
    /www\.\S+/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return suspiciousPatterns.some((pattern) =>
    pattern.test(text)
  );
};

// ================================
// REPEATED CHARACTERS
// ================================
export const hasRepeatedCharacters = (text) => {
  return /(.)\1{7,}/u.test(text);
};

// ================================
// REPEATED WORDS
// ================================
export const hasRepeatedWords = (text) => {
  const words = normalizeText(text)
    .split(" ")
    .filter(Boolean);

  if (words.length < 4) {
    return false;
  }

  let repeatedCount = 1;

  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      repeatedCount++;

      if (repeatedCount >= 4) {
        return true;
      }
    } else {
      repeatedCount = 1;
    }
  }

  return false;
};

// ================================
// EMOJI / SPECIAL CHARACTER SPAM
// ================================
export const hasExcessiveSpecialCharacters = (
  text
) => {
  if (!text || text.length < 8) {
    return false;
  }

  const normalCharacters =
    text.match(/[a-zA-Z0-9\s]/g)?.length || 0;

  const specialCharacters =
    text.length - normalCharacters;

  const specialRatio =
    specialCharacters / text.length;

  return specialRatio >= 0.75;
};

// ================================
// EXCESSIVE CAPITAL LETTERS
// ================================
export const hasExcessiveCaps = (text) => {
  const letters = text.match(/[a-zA-Z]/g) || [];

  if (letters.length < 10) {
    return false;
  }

  const uppercaseLetters = text.match(/[A-Z]/g) || [];

  return uppercaseLetters.length / letters.length >= 0.8;
};

// ================================
// PROMOTIONAL SPAM
// ================================
export const containsPromotionalSpam = (text) => {
  const normalized = normalizeText(text);

  const spamPatterns = [
    /\b(buy now|click here|subscribe now|follow me|dm me)\b/i,
    /\b(make money|earn money|get rich|free money)\b/i,
    /\b(visit my channel|check my channel|check my profile)\b/i,
    /\b(limited offer|special offer|discount|promo code)\b/i,
  ];

  return spamPatterns.some((pattern) => pattern.test(normalized));
};

// ================================
// OVERALL SAFETY CHECK
// ================================
export const validateCommentSafety = (text) => {
  if (containsProfanity(text)) {
    return {
      allowed: false,
      message:
        "Your comment contains inappropriate language.",
    };
  }

  if (containsSuspiciousLink(text)) {
    return {
      allowed: false,
      message:
        "Links are not allowed in comments.",
    };
  }

  if (hasRepeatedCharacters(text)) {
    return {
      allowed: false,
      message:
        "Please avoid repeated characters or spam.",
    };
  }

  if (hasRepeatedWords(text)) {
    return {
      allowed: false,
      message:
        "Please avoid repeating the same text.",
    };
  }

  if (hasExcessiveSpecialCharacters(text)) {
    return {
      allowed: false,
      message:
        "Please avoid excessive special characters or emojis.",
    };
  }

  if (hasExcessiveCaps(text)) {
  return {
    allowed: false,
    message:
      "Please avoid excessive use of capital letters.",
  };
}

if (containsPromotionalSpam(text)) {
  return {
    allowed: false,
    message:
      "Promotional or spam comments are not allowed.",
  };
}

  return {
    allowed: true,
    message: "",
  };
};