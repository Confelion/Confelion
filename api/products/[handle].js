const products = require('../products_catalog.json');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { handle } = req.query || {};

  if (!handle) {
    return res.status(400).json({ error: 'Handle required' });
  }

  const cleanHandle = String(handle).trim().toLowerCase();
  const found = products.find(p => 
    (p.handle && p.handle.toLowerCase() === cleanHandle) ||
    (p.id && String(p.id).toLowerCase() === cleanHandle)
  );

  if (found) {
    const images = (found.images && found.images.length > 0) ? found.images : [found.image_url];
    return res.status(200).json({
      product: found,
      variants: (found.sizes || ['S', 'M', 'L', 'XL', 'XXL']).map(s => ({
        id: s,
        title: s,
        inventory_quantity: found.inventory !== undefined ? found.inventory : 10,
        price: found.price,
        compare_at_price: found.compare_at_price
      })),
      productImages: images.map((url, i) => ({ id: i + 1, image_url: url, position: i + 1 })),
      options: [{ id: 1, name: 'Size', value: (found.sizes || []).join(', ') }]
    });
  }

  return res.status(404).json({ error: 'Product not found' });
};
