import express from "express";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text?.trim() || !targetLanguage) {
      return res.status(400).json({
        message: "Text and target language are required",
      });
    }

    const url =
      `https://api.mymemory.translated.net/get` +
      `?q=${encodeURIComponent(text.trim())}` +
      `&langpair=${encodeURIComponent(`autodetect|${targetLanguage}`)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Translation service unavailable");
    }

    const data = await response.json();

    const translatedText =
      data?.responseData?.translatedText;

    if (!translatedText) {
      throw new Error("Translation failed");
    }

    return res.status(200).json({
      translatedText,
      targetLanguage,
    });
  } catch (error) {
    console.error("Translation error:", error);

    return res.status(500).json({
      message:
        "Translation failed. Please try again later.",
    });
  }
});

export default router;