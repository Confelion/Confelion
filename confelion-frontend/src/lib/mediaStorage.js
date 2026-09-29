import { uploadFileToR2, uploadVideoDirectToR2 } from './r2Storage';
import { uploadFileToFirebaseStorage } from './firebase';

/**
 * Helper to convert File to compressed Data URL fallback
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Unified Media Upload Service:
 * 1. Cloudflare R2 / Server Upload (/api/storage/upload)
 * 2. Firebase Cloud Storage (fallback)
 * 3. Client DataURL (instant fallback)
 * 
 * @param {File|Blob} file - The file to upload
 * @param {string} folder - Target directory ('products', 'banners', 'heroes', 'reels', 'size_charts')
 * @returns {Promise<{ url: string, provider: string }>}
 */
export async function uploadMediaAsset(file, folder = 'uploads') {
  if (!file) throw new Error('No file provided for upload');

  // 1. Try Cloudflare R2 / Server API storage first
  try {
    const isVideo = file.type && file.type.startsWith('video/');
    let url = null;
    if (isVideo && file.name) {
      try {
        url = await uploadVideoDirectToR2(file, folder);
      } catch {
        url = await uploadFileToR2(file, folder);
      }
    } else {
      url = await uploadFileToR2(file, folder);
    }

    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads') || url.startsWith('/'))) {
      return { url, provider: 'cloudflare-r2' };
    }
  } catch (r2Err) {
    console.warn('[Storage Notification] R2/Server upload skipped, trying Firebase Storage:', r2Err.message);
  }

  // 2. Try Firebase Cloud Storage
  try {
    const fbUrl = await uploadFileToFirebaseStorage(file, folder);
    if (fbUrl) {
      return { url: fbUrl, provider: 'firebase-storage' };
    }
  } catch (fbErr) {
    console.warn('[Storage Notification] Firebase Storage skipped:', fbErr.message);
  }

  // 3. Fallback to client-side data URL so product creation never fails
  try {
    const dataUrl = await fileToDataUrl(file);
    return { url: dataUrl, provider: 'client-cache' };
  } catch (dataErr) {
    throw new Error('Unable to process image file');
  }
}
