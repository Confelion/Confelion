import { uploadFileToR2, uploadVideoDirectToR2 } from './r2Storage';
import { uploadFileToFirebaseStorage } from './firebase';

/**
 * Unified Media Upload Service.
 * Coordinates between Cloudflare R2, Firebase Storage, and local fallback.
 * 
 * Hierarchy:
 * 1. Cloudflare R2 (Default object storage for zero egress fees)
 * 2. Firebase Storage (Secondary cloud storage fallback)
 * 3. Local fallback (Caller handles image compression / IndexedDB if cloud fails)
 * 
 * @param {File|Blob} file - The file to upload
 * @param {string} folder - Target directory ('products', 'banners', 'reels', 'size_charts')
 * @returns {Promise<{ url: string, provider: 'cloudflare-r2' | 'firebase-storage' }>}
 */
export async function uploadMediaAsset(file, folder = 'uploads') {
  if (!file) throw new Error('No file provided');

  // 1. Attempt upload to Cloudflare R2
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
  } catch (r2Err) {
    // Cloudflare R2 pending or offline, proceed to fallback
    console.warn('Cloudflare R2 upload note:', r2Err.message);
  }

  // 2. Attempt upload to Firebase Storage (with 6s timeout protection)
  try {
    const fbPromise = uploadFileToFirebaseStorage(file, folder);
    const fbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase Storage timeout')), 6000));
    const fbUrl = await Promise.race([fbPromise, fbTimeout]);
    if (fbUrl) {
      return { url: fbUrl, provider: 'firebase-storage' };
    }
  } catch (fbErr) {
    console.warn('Firebase Storage upload note:', fbErr.message);
  }

  // 3. If neither cloud provider is active yet, throw so UI applies local compression fallback
  throw new Error('Cloud storage providers (R2/Firebase) pending API configuration');
}
