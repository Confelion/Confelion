const crypto = require('crypto')
const {auth, admin} = require('../middleware/auth')

module.exports = db => {
  const r = require('express').Router()

  // Public: Get preview data by token (no auth required)
  r.get('/data/:token', (req, res) => {
    try {
      const pt = db.prepare('SELECT * FROM preview_tokens WHERE token = ?').get(req.params.token)
      if (!pt) return res.status(404).json({error: 'Preview link not found or expired'})

      if (pt.expires_at && new Date(pt.expires_at) < new Date()) {
        return res.status(410).json({error: 'This preview link has expired'})
      }

      // Fetch current settings
      const rows = db.prepare('SELECT key, value FROM settings').all()
      const settings = {}
      rows.forEach(r => settings[r.key] = r.value)

      // Fetch published products
      const products = db.prepare(`
        SELECT p.*,
          (SELECT inventory_quantity FROM variants WHERE product_id=p.id LIMIT 1) as qty,
          (SELECT id FROM variants WHERE product_id=p.id LIMIT 1) as variant_id,
          (SELECT price FROM variants WHERE product_id=p.id LIMIT 1) as price,
          (SELECT image_url FROM product_images WHERE product_id=p.id LIMIT 1) as image_url
        FROM products p WHERE p.published = 1 ORDER BY p.id DESC
      `).all()

      // Fetch product images for each product
      const productsWithImages = products.map(p => {
        const images = db.prepare('SELECT image_url FROM product_images WHERE product_id = ? ORDER BY position').all(p.id)
        return {...p, images: images.map(i => i.image_url)}
      })

      res.json({
        title: pt.title,
        settings,
        products: productsWithImages,
        expires_at: pt.expires_at
      })
    } catch (e) {
      res.status(500).json({error: e.message})
    }
  })

  // Admin-only routes: create, list, delete tokens
  r.post('/tokens', auth, admin, (req, res) => {
    try {
      const token = crypto.randomBytes(16).toString('hex')
      const {title, expiresInDays = 7} = req.body || {}
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)

      db.prepare('INSERT INTO preview_tokens(token, title, created_by, expires_at) VALUES(?,?,?,?)').run(
        token,
        title || 'Website Preview',
        req.user?.id || null,
        expiresAt.toISOString()
      )

      res.json({token, expires_at: expiresAt.toISOString(), title: title || 'Website Preview'})
    } catch (e) {
      res.status(500).json({error: e.message})
    }
  })

  r.get('/tokens', auth, admin, (req, res) => {
    try {
      const tokens = db.prepare('SELECT * FROM preview_tokens ORDER BY created_at DESC').all()
      res.json(tokens)
    } catch (e) {
      res.status(500).json({error: e.message})
    }
  })

  r.delete('/tokens/:token', auth, admin, (req, res) => {
    try {
      db.prepare('DELETE FROM preview_tokens WHERE token = ?').run(req.params.token)
      res.json({success: true})
    } catch (e) {
      res.status(500).json({error: e.message})
    }
  })

  return r
}

