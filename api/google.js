export default async function handler(req, res) {
  try {
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;

    if (!GOOGLE_SCRIPT_URL) {
      return res.status(500).json({
        success: false,
        message: "GOOGLE_SCRIPT_URL is missing in Vercel environment variables.",
      });
    }

    const query = new URLSearchParams(req.query).toString();
    const url = `${GOOGLE_SCRIPT_URL}?${query}`;

    const response = await fetch(url);
    const text = await response.text();

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}