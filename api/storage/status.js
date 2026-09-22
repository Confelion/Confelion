module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    configured: true,
    provider: 'cloudflare-r2',
    bucket: process.env.R2_BUCKET_NAME || 'paypertap-assets',
    publicDomain: process.env.R2_PUBLIC_DOMAIN || 'https://pub-2dfcf8b99fc24f2e936e2826ab666474.r2.dev',
    timestamp: new Date().toISOString()
  });
};
