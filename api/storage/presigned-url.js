const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '3c5ba93432561f66462c312cabbd800f';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || 'b535848ad8f04c7a028d1395620e7ace';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '400c933d990a6db69cefc927e89c221ad099e02ab96b68a6c0bd4a759dbc896a';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'paypertap-assets';
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_DOMAIN = (process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_DOMAIN || 'https://pub-2dfcf8b99fc24f2e936e2826ab666474.r2.dev').replace(/\/+$/, '');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { filename, contentType = 'video/mp4', folder = 'reels' } = body;

    const ext = path.extname(filename || 'video.mp4') || '.mp4';
    const base = path.basename(filename || 'video', ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40) || 'reel';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const storageKey = `uploads/${folder}/${timestamp}-${random}-${base}${cleanExt}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = `${R2_PUBLIC_DOMAIN}/${storageKey}`;

    return res.status(200).json({
      success: true,
      configured: true,
      uploadUrl,
      publicUrl,
      key: storageKey,
      provider: 'cloudflare-r2'
    });
  } catch (err) {
    console.error('[Presigned URL Error]:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate pre-signed URL',
      configured: false
    });
  }
};
