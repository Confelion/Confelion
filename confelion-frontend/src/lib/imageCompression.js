/**
 * Client-Side Advanced Image Compression Engine
 * Adapted and optimized for Confelion luxury e-commerce.
 * Converts heavy raw photos into modern, ultra-compact WebP blobs before transmission.
 */

const KILOBYTE = 1024;
const QUALITY_STEP = 0.06;

export const IMAGE_COMPRESSION_PRESETS = {
  productMain: {
    maxLongestSide: 1200,
    quality: 0.80,
    minQuality: 0.60,
    targetBytes: 450 * KILOBYTE,
    softMaxBytes: 600 * KILOBYTE,
    dimensionSteps: [1200, 1080, 960],
    outputType: 'image/webp',
    suffix: 'product',
  },
  storefrontHero: {
    maxLongestSide: 1920,
    quality: 0.82,
    minQuality: 0.62,
    targetBytes: 750 * KILOBYTE,
    softMaxBytes: 950 * KILOBYTE,
    dimensionSteps: [1920, 1600, 1400],
    outputType: 'image/webp',
    suffix: 'hero',
  },
  storefrontBanner: {
    maxLongestSide: 1920,
    quality: 0.82,
    minQuality: 0.60,
    targetBytes: 800 * KILOBYTE,
    softMaxBytes: 1000 * KILOBYTE,
    dimensionSteps: [1920, 1600, 1400],
    outputType: 'image/webp',
    suffix: 'banner',
  },
  storeLogo: {
    maxLongestSide: 768,
    quality: 0.85,
    minQuality: 0.68,
    targetBytes: 250 * KILOBYTE,
    softMaxBytes: 350 * KILOBYTE,
    dimensionSteps: [768, 512],
    outputType: 'image/webp',
    preserveTransparency: true,
    suffix: 'logo',
  },
  lookbookPoster: {
    maxLongestSide: 1280,
    quality: 0.80,
    minQuality: 0.60,
    targetBytes: 400 * KILOBYTE,
    softMaxBytes: 550 * KILOBYTE,
    dimensionSteps: [1280, 1080],
    outputType: 'image/webp',
    suffix: 'poster',
  }
};

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export function isAllowedImageFile(file) {
  if (!file) return false;
  if (allowedImageMimeTypes.has(file.type)) return true;
  const ext = file.name?.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext);
}

export function assertValidImageFile(file) {
  if (!isAllowedImageFile(file)) {
    throw new Error('Please choose a valid PNG, JPG, JPEG, or WebP image.');
  }
}

/**
 * Load image into a CanvasImageSource using createImageBitmap or HTMLImageElement
 */
async function loadImageSource(file) {
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmapPromise = createImageBitmap(file, { imageOrientation: 'from-image' });
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('createImageBitmap timeout')), 2500));
      const bitmap = await Promise.race([bitmapPromise, timeoutPromise]);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to standard Image element
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Image load timeout'));
      }, 2500);
      const el = new Image();
      el.onload = () => {
        clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Could not read image file'));
      };
      el.src = objectUrl;
    });

    return {
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      dispose: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function getTargetDimensions(width, height, maxLongestSide) {
  const longest = Math.max(width, height);
  if (longest <= maxLongestSide) {
    return { width, height };
  }
  const scale = maxLongestSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('canvas.toBlob timeout'));
    }, 1500);
    try {
      canvas.toBlob(
        (blob) => {
          clearTimeout(timer);
          if (!blob) return reject(new Error('Canvas compression failed'));
          resolve(blob);
        },
        type,
        quality
      );
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

function getCleanFilename(filename, suffix) {
  const base = filename
    .replace(/\.[^.]+$/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
  return `${base}-${suffix}.webp`;
}

/**
 * Compresses an image File in the browser using HTML5 Canvas
 * @param {File} file
 * @param {Object} preset
 * @returns {Promise<File>}
 */
export async function compressImage(file, preset = IMAGE_COMPRESSION_PRESETS.productMain) {
  // If not a browser environment or not an image, return original
  if (typeof window === 'undefined' || !isAllowedImageFile(file)) {
    return file;
  }

  // Enforce a strict 3-second timeout: if client compression stalls, fall through to backend Sharp
  const compressionWork = (async () => {
    let source = null;
    try {
      source = await loadImageSource(file);

      const steps = preset.dimensionSteps || [preset.maxLongestSide];
      let bestBlob = null;
      let bestQuality = preset.quality;

      for (const maxSide of steps) {
        const { width, height } = getTargetDimensions(source.width, source.height, maxSide);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: Boolean(preset.preserveTransparency) });

        if (!preset.preserveTransparency) {
          ctx.fillStyle = '#000000'; // All-black luxury canvas base
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(source.image, 0, 0, width, height);

        for (let q = preset.quality; q >= preset.minQuality; q -= QUALITY_STEP) {
          const normalizedQ = Number(q.toFixed(2));
          const blob = await canvasToBlob(canvas, 'image/webp', normalizedQ);

          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
            bestQuality = normalizedQ;
          }

          if (blob.size <= preset.targetBytes) {
            break;
          }
        }

        if (bestBlob && bestBlob.size <= preset.softMaxBytes) {
          break;
        }
      }

      if (!bestBlob) {
        return file;
      }

      const compressedName = getCleanFilename(file.name, preset.suffix);
      return new File([bestBlob], compressedName, {
        type: 'image/webp',
        lastModified: Date.now(),
      });
    } catch (err) {
      console.warn('[Image Compression Note] Browser canvas compression skipped:', err.message);
      return file;
    } finally {
      if (source && typeof source.dispose === 'function') {
        source.dispose();
      }
    }
  })();

  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(file), 3000));
  return Promise.race([compressionWork, timeoutPromise]);
}

export function compressProductImage(file) {
  return compressImage(file, IMAGE_COMPRESSION_PRESETS.productMain);
}

export function compressHeroBanner(file) {
  return compressImage(file, IMAGE_COMPRESSION_PRESETS.storefrontHero);
}

export function compressEditorialBanner(file) {
  return compressImage(file, IMAGE_COMPRESSION_PRESETS.storefrontBanner);
}

export function compressStoreLogo(file) {
  return compressImage(file, IMAGE_COMPRESSION_PRESETS.storeLogo);
}

export function compressLookbookPoster(file) {
  return compressImage(file, IMAGE_COMPRESSION_PRESETS.lookbookPoster);
}
