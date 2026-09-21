// IndexedDB and YouTube utilities for Lookbook Video Reels

const DB_NAME = 'confelion_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'reels_videos';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDeviceVideo(key, fileOrBlob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(fileOrBlob, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getDeviceVideoUrl(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          const url = URL.createObjectURL(req.result);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not load device video from IndexedDB:', err);
    return null;
  }
}

export async function deleteDeviceVideo(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not delete device video:', err);
    return false;
  }
}

export function parseYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return { isYouTube: false };
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);

  if (match && match[1]) {
    const videoId = match[1];
    return {
      isYouTube: true,
      videoId,
      embedUrl: "https://www.youtube.com/embed/" + videoId + "?autoplay=1&mute=1&loop=1&playlist=" + videoId + "&controls=0&modestbranding=1&playsinline=1&rel=0",
      watchUrl: "https://www.youtube.com/watch?v=" + videoId,
      thumbnailUrl: "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg"
    };
  }
  return { isYouTube: false };
}
