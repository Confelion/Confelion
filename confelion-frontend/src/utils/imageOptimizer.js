export const PLACEHOLDER_IMAGE = '/images/product-placeholder.svg';

/**
 * Optimizes an image URL for maximum loading speed and minimal bandwidth.
 * - Converts raw Shopify CDN images to WebP with target width/height
 * - Strips any slow/external pollinations.ai dependencies
 * - Provides graceful fallbacks to the local SVG placeholder
 */
export function optimizeImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return PLACEHOLDER_IMAGE;
  
  // Guard against slow on-the-fly AI generation endpoints
  if (url.includes('pollinations.ai')) {
    return PLACEHOLDER_IMAGE;
  }

  const { width = 500, height = 650, format = 'webp', crop = 'center' } = options;

  // Shopify CDN transformation (reduces 1MB+ PNGs to ~60-90KB WebP)
  if (url.includes('cdn.shopify.com')) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set('width', width.toString());
      if (height) parsed.searchParams.set('height', height.toString());
      if (crop) parsed.searchParams.set('crop', crop);
      parsed.searchParams.set('format', format);
      return parsed.toString();
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}width=${width}&format=${format}`;
    }
  }

  return url;
}
