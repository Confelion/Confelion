const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

// Cloudflare R2 Credentials & Endpoint
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
    let buffer = null;
    let originalName = 'asset.webp';
    let mimeType = 'image/webp';
    let folder = 'uploads';

    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      // JSON body mode with base64 data
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      let rawBase64 = body.fileData || body.base64 || '';
      if (!rawBase64) {
        return res.status(400).json({ error: 'Missing fileData in JSON payload' });
      }

      // Handle data URL prefix if present: data:image/webp;base64,....
      const match = rawBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        rawBase64 = match[2];
      } else if (body.fileType) {
        mimeType = body.fileType;
      }

      buffer = Buffer.from(rawBase64, 'base64');
      originalName = body.fileName || body.filename || `asset-${Date.now()}`;
      folder = body.folder || 'uploads';
    } else {
      // Multipart or raw buffer mode
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
      originalName = req.query?.filename || `file-${Date.now()}`;
      folder = req.query?.folder || 'uploads';
      mimeType = contentType || 'application/octet-stream';
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Empty file payload' });
    }

    // Sanitize key name
    const ext = path.extname(originalName) || (mimeType.includes('webp') ? '.webp' : mimeType.includes('png') ? '.png' : '.jpg');
    const base = path.basename(originalName, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40) || 'media';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
    const storageKey = `uploads/${folder}/${timestamp}-${random}-${base}${cleanExt}`;

    // Upload to Cloudflare R2
    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    const publicUrl = `${R2_PUBLIC_DOMAIN}/${storageKey}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      key: storageKey,
      size: buffer.length,
      mimeType,
      provider: 'cloudflare-r2',
    });
  } catch (err) {
    console.error('[Vercel Serverless Upload Error]:', err);
    return res.status(500).json({
      error: err.message || 'Upload failed',
      provider: 'cloudflare-r2',
    });
  }
};
