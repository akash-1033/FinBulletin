const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

let filteredHeadlines;
let userPortfolio;

module.exports = (fh, up) => {
  filteredHeadlines = fh;
  userPortfolio = up;
  return router;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildSentimentPrompt(stocks, headlines) {
  return `Given the following stock symbols: ${stocks.join(", ")}
And these news headlines (with source and timestamp):\n${headlines
    .map((h) => `- [${h.source}] ${h.title} (${h.timestamp})`)
    .join("\n")}

Analyze the sentiment for each stock based on the news. For each stock, return a JSON object in this format:
{
  "SYMBOL": {
    "sentiment": "Positive|Negative|Neutral",
    "confidence": <number between 0 and 1>,
    "reason": "Short explanation based on the news headlines or 'No relevant news found' if not present."
  },
  ...
}
If a stock does not appear in any headline, return 'Neutral' sentiment, low confidence (e.g. 0.1), and reason 'No relevant news found'. Only include stocks from the portfolio. Be concise and accurate.`;
}

router.get("/", async (req, res) => {
  const stocks = userPortfolio || [];
  const headlines = filteredHeadlines || [];
  if (!stocks.length || !headlines.length) {
    return res.status(400).json({
      success: false,
      message: "No stocks or news headlines available for analysis.",
    });
  }
  const prompt = buildSentimentPrompt(stocks, headlines);
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
    res.json({
      success: true,
      result: JSON.parse(cleanedText),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get analysis from Gemini API",
    });
  }
});
