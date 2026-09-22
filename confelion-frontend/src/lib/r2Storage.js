/**
 * Cloudflare R2 Client Storage Service
 * Handles uploading files directly to Cloudflare R2 via the backend API
 * with client-side progressive WebP compression to minimize bandwidth and storage.
 */

import {
  compressImage,
  IMAGE_COMPRESSION_PRESETS,
  isAllowedImageFile
} from './imageCompression';

const API_BASE = '';

function getPresetForFolder(folder) {
  if (folder === 'products') return IMAGE_COMPRESSION_PRESETS.productMain;
  if (folder === 'heroes') return IMAGE_COMPRESSION_PRESETS.storefrontHero;
  if (folder === 'banners') return IMAGE_COMPRESSION_PRESETS.storefrontBanner;
  if (folder === 'stores' || folder === 'logos') return IMAGE_COMPRESSION_PRESETS.storeLogo;
  if (folder === 'reels') return IMAGE_COMPRESSION_PRESETS.lookbookPoster;
  return IMAGE_COMPRESSION_PRESETS.productMain;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload a file (image or video) to Cloudflare R2 with client-side pre-compression.
 * @param {File|Blob} file - The file to upload
 * @param {string} folder - Target folder ('products', 'banners', 'heroes', 'reels', etc.)
 * @returns {Promise<string>} The live public R2 URL
 */
export async function uploadFileToR2(file, folder = 'uploads') {
  if (!file) throw new Error('No file provided for R2 upload');

  let uploadFile = file;

  // Perform client-side compression for image files
  const isImage = isAllowedImageFile(file);
  if (isImage) {
    try {
      const preset = getPresetForFolder(folder);
      uploadFile = await compressImage(file, preset);
      console.info(`[Client Compression] ${file.name || 'image'} compressed: ${(file.size / 1024).toFixed(1)}KB -> ${(uploadFile.size / 1024).toFixed(1)}KB`);
    } catch (compressErr) {
      console.warn('Client-side compression skipped:', compressErr.message);
    }
  }

  // 1. Try robust JSON payload upload first (ideal for serverless functions & cross-platform)
  try {
    const base64Data = await blobToBase64(uploadFile);
    const jsonRes = await fetch(`${API_BASE}/api/storage/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileData: base64Data,
        fileName: file.name || 'image.webp',
        fileType: uploadFile.type || 'image/webp',
        folder,
      }),
    });

    if (jsonRes.ok) {
      const text = await jsonRes.text();
      try {
        const data = JSON.parse(text);
        if (data && data.url) {
          console.info('[R2 Upload Success via JSON]:', data.url);
          return data.url;
        }
      } catch (parseErr) {
        console.warn('Server returned non-JSON response to JSON upload, trying multipart fallback');
      }
    }
  } catch (jsonErr) {
    console.warn('[R2 JSON upload attempt error, trying multipart]:', jsonErr.message);
  }

  // 2. Fallback to multipart FormData
  const formData = new FormData();
  formData.append('file', uploadFile);
  formData.append('folder', folder);

  const response = await fetch(`${API_BASE}/api/storage/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    let errMessage = `R2 upload failed: HTTP ${response.status}`;
    try {
      const errData = JSON.parse(errText);
      if (errData.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }

  const resText = await response.text();
  try {
    const data = JSON.parse(resText);
    if (data && data.url) {
      console.info('[R2 Upload Success via Multipart]:', data.url);
      return data.url;
    }
  } catch {
    throw new Error('Storage service returned invalid response format');
  }

  throw new Error('R2 upload succeeded but no URL was returned');
}

/**
 * Upload large files (e.g. video reels) directly to Cloudflare R2 via pre-signed URL.
 * Bypasses backend memory limits for high efficiency.
 * @param {File} file - The video file
 * @param {string} folder - Target directory (default: 'reels')
 * @returns {Promise<string>} The live public R2 URL
 */
export async function uploadVideoDirectToR2(file, folder = 'reels') {
  if (!file) throw new Error('No video file provided');

  // 1. Request presigned upload URL from backend
  const presignRes = await fetch(`${API_BASE}/api/storage/presigned-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'video/mp4',
      folder
    })
  });

  if (!presignRes.ok) {
    throw new Error('Could not get presigned upload URL');
  }

  const { uploadUrl, publicUrl, configured } = await presignRes.json();
  if (configured === false || !uploadUrl) {
    throw new Error('Cloudflare R2 is not yet configured with active credentials');
  }

  // 2. Direct PUT stream to Cloudflare R2 bucket with 1-year immutable cache header
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'video/mp4',
      'Cache-Control': 'public, max-age=31536000, immutable'
    },
    body: file
  });

  if (!putRes.ok) {
    throw new Error(`Direct R2 upload failed with HTTP status ${putRes.status}`);
  }

  return publicUrl;
}
