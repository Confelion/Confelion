import { uploadFileToR2, uploadVideoDirectToR2 } from './r2Storage';

/**
 * Cloudflare R2 Media Upload Service.
 * Strictly stores all images and media assets in Cloudflare R2 with progressive compression.
 * Firebase Storage is explicitly disabled for media storage per architecture requirements.
 * 
 * @param {File|Blob} file - The file to upload
 * @param {string} folder - Target directory ('products', 'banners', 'heroes', 'reels', 'size_charts')
 * @returns {Promise<{ url: string, provider: 'cloudflare-r2' }>}
 */
export async function uploadMediaAsset(file, folder = 'uploads') {
  if (!file) throw new Error('No file provided for upload');

  // Strictly upload to Cloudflare R2 with client & server compression
  try {
    const isVideo = file.type && file.type.startsWith('video/');
    let r2Url = null;
    if (isVideo && file.name) {
      try {
        r2Url = await uploadVideoDirectToR2(file, folder);
      } catch {
        r2Url = await uploadFileToR2(file, folder);
      }
    } else {
      r2Url = await uploadFileToR2(file, folder);
    }

    if (r2Url && (r2Url.startsWith('http://') || r2Url.startsWith('https://'))) {
      return { url: r2Url, provider: 'cloudflare-r2' };
    }
    throw new Error('Cloudflare R2 returned an invalid URL');
  } catch (r2Err) {
    console.error('Cloudflare R2 media upload error:', r2Err);
    throw new Error(`Cloudflare R2 upload error: ${r2Err.message || 'Storage unavailable'}`);
  }
}

