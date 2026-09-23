const PLACEHOLDER_URL = '/images/product-placeholder.svg';

function aiUrl(handle, title, tags) {
  // Return instant local SVG placeholder - zero network latency, no external AI cluster calls
  return PLACEHOLDER_URL;
}

function shopifyLight(url, width = 500, height = 650) {
  if (!url) return PLACEHOLDER_URL;
  if (url.includes('pollinations.ai')) return PLACEHOLDER_URL;
  // Shopify CDN supports width/format compression: ~80-90% size reduction
  if (url.includes('cdn.shopify.com')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}width=${width}&crop=center&format=webp`;
  }
  return url;
}

function getLightImage(p) {
  if (!p) return PLACEHOLDER_URL;
  if (p.image_url) return shopifyLight(p.image_url);
  return PLACEHOLDER_URL;
}

module.exports = { aiUrl, shopifyLight, getLightImage, PLACEHOLDER_URL };