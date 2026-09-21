require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');
const { getDb } = require('../db');

// Cloudflare R2 Credentials & Endpoint Configuration
// Supports both CLOUDFLARE_R2_* and R2_* env naming schemes
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '3c5ba93432561f66462c312cabbd800f';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'paypertap-assets';
const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const R2_PUBLIC_DOMAIN = (process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_DOMAIN || 'https://pub-2dfcf8b99fc24f2e936e2826ab666474.r2.dev').replace(/\/+$/, '');

const PUBLIC_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function isR2Configured() {
  return Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_ENDPOINT);
}

let s3Client = null;

function getR2Client() {
  if (!isR2Configured()) {
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Build clean, sanitized object key in R2
 */
function toSafeKey(filename, folder = 'uploads', ext = '.webp') {
  const base = path.basename(filename || 'image', path.extname(filename || ''))
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50) || 'asset';
  const timestamp = Date.now();
  const random = crypto.randomBytes(6).toString('hex');
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
  return `uploads/${folder}/${timestamp}-${random}-${base}${cleanExt}`;
}

/**
 * Powerful image compression using Sharp.
 * Adapts presets based on media role (product, hero, banner, logo, size_chart).
 * Converts to modern WebP with optimized quality and strips all EXIF metadata.
 */
async function compressImageBuffer(buffer, folder = 'products') {
  const metadata = await sharp(buffer).metadata().catch(() => ({}));
  const isTransparent = metadata.hasAlpha || metadata.format === 'png';

  let pipeline = sharp(buffer).rotate(); // auto-orient via EXIF before stripping

  if (folder === 'products') {
    // Product images: max 1200x1500 (standard luxury 4:5 fashion ratio or fit inside)
    pipeline = pipeline
      .resize(1200, 1500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 });
  } else if (folder === 'heroes' || folder === 'banners') {
    // Large editorial & hero banners: max 1920x1080 (landscape)
    pipeline = pipeline
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 });
  } else if (folder === 'stores' || folder === 'logos') {
    // Brand logos & crests: preserve alpha transparency, crisp edges
    pipeline = pipeline
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 6 });
  } else if (folder === 'size_charts') {
    // Detailed dimension tables
    pipeline = pipeline
      .resize(1400, 1800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 });
  } else if (folder === 'reels') {
    // Lookbook motion video posters (9:16 vertical smartphone format)
    pipeline = pipeline
      .resize(720, 1280, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 });
  } else {
    // General fallback
    pipeline = pipeline
      .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 });
  }

  const outputBuffer = await pipeline.toBuffer();
  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    mimeType: 'image/webp',
    width: outputMeta.width,
    height: outputMeta.height,
    size: outputBuffer.length
  };
}

/**
 * Check if the asset already exists by SHA-256 hash in our database.
 * If found, returns existing R2 public URL directly (Zero Class A writes!).
 */
function findExistingAssetByHash(hash) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM media_assets WHERE hash = ? LIMIT 1').get(hash);
    return row || null;
  } catch {
    return null;
  }
}

/**
 * Record successfully uploaded asset into database for deduplication caching.
 */
function recordAssetInDb({ hash, originalName, key, publicUrl, mimeType, fileSize, width, height, folder }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO media_assets(hash, original_name, r2_key, public_url, mime_type, file_size, width, height, folder)
      VALUES(?,?,?,?,?,?,?,?,?)
    `).run(hash, originalName || null, key, publicUrl, mimeType || null, fileSize || null, width || null, height || null, folder || 'uploads');
  } catch (err) {
    console.warn('[R2 DB Record Note]:', err.message);
  }
}

/**
 * Unified Upload Handler:
 * 1. Hashes content for zero-Class-A deduplication
 * 2. Compresses images to modern WebP via Sharp
 * 3. Enforces immutable edge caching
 * 4. Writes to Cloudflare R2
 */
async function compressAndUploadToR2({ buffer, originalName = 'image.png', folder = 'uploads', mimetype = '' }) {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured. Check R2 credentials in .env');
  }

  const originalSize = buffer.length;
  const isVideo = mimetype.startsWith('video/') || (/\.(mp4|webm|mov|m4v)$/i).test(originalName);

  // Compute SHA-256 hash of original buffer
  const rawHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check deduplication cache
  const existing = findExistingAssetByHash(rawHash);
  if (existing) {
    console.info(`[R2 Deduplication Cache Hit] Avoided Class A PutObject write for: ${originalName}`);
    return {
      success: true,
      url: existing.public_url,
      key: existing.r2_key,
      deduplicated: true,
      originalSize,
      compressedSize: existing.file_size,
      savingsPercent: originalSize > 0 ? Math.round((1 - existing.file_size / originalSize) * 100) : 0,
      mimeType: existing.mime_type,
      width: existing.width,
      height: existing.height,
      provider: 'cloudflare-r2'
    };
  }

  let finalBuffer = buffer;
  let finalMime = mimetype || 'application/octet-stream';
  let width = null;
  let height = null;
  let targetExt = path.extname(originalName) || '.bin';

  // If image, compress through Sharp
  if (!isVideo && (mimetype.startsWith('image/') || (/\.(jpg|jpeg|png|webp|gif|avif)$/i).test(originalName))) {
    try {
      const compressed = await compressImageBuffer(buffer, folder);
      finalBuffer = compressed.buffer;
      finalMime = compressed.mimeType;
      width = compressed.width;
      height = compressed.height;
      targetExt = '.webp';
    } catch (sharpErr) {
      console.warn('Sharp compression fallback to original buffer:', sharpErr.message);
    }
  }

  const compressedSize = finalBuffer.length;
  const storageKey = toSafeKey(originalName, folder, targetExt);
  const client = getR2Client();

  // Send PutObject to Cloudflare R2 with 1-year immutable edge cache
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storageKey,
      Body: finalBuffer,
      ContentType: finalMime,
      CacheControl: PUBLIC_CACHE_CONTROL,
    })
  );

  const publicUrl = `${R2_PUBLIC_DOMAIN}/${storageKey}`;

  // Record into media_assets table
  recordAssetInDb({
    hash: rawHash,
    originalName,
    key: storageKey,
    publicUrl,
    mimeType: finalMime,
    fileSize: compressedSize,
    width,
    height,
    folder
  });

  const savingsPercent = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;

  return {
    success: true,
    url: publicUrl,
    key: storageKey,
    deduplicated: false,
    originalSize,
    compressedSize,
    savingsPercent,
    mimeType: finalMime,
    width,
    height,
    provider: 'cloudflare-r2'
  };
}

/**
 * Generate a pre-signed PUT URL for direct client-side uploads (ideal for large videos).
 */
async function getPresignedUploadUrl({ key, contentType = 'video/mp4', folder = 'reels', expiresIn = 3600 }) {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured.');
  }

  const client = getR2Client();
  const safeKey = key || toSafeKey('video.mp4', folder, '.mp4');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: safeKey,
    ContentType: contentType,
    CacheControl: PUBLIC_CACHE_CONTROL,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = `${R2_PUBLIC_DOMAIN}/${safeKey}`;

  return {
    uploadUrl,
    publicUrl,
    key: safeKey,
  };
}

module.exports = {
  isR2Configured,
  getR2Client,
  compressImageBuffer,
  compressAndUploadToR2,
  getPresignedUploadUrl,
  config: {
    accountId: R2_ACCOUNT_ID,
    bucketName: R2_BUCKET_NAME,
    publicDomain: R2_PUBLIC_DOMAIN,
  }
};
