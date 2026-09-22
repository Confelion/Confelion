module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Fallback defaults for serverless environment without SQLite
  const defaultSettings = {
    hero_image: "",
    hero_image_pc: "",
    hero_image_mobile: "",
    hero_headline: "AUTUMN / WINTER 2026",
    hero_subheadline: "THE MONOCHROME ESSENTIALS",
    hero_button_text: "Shop Now",
    hero_button_link: "/products"
  };

  res.status(200).json(defaultSettings);
};
