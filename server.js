require('dotenv').config()
const express = require('express')
const path = require('path')
const cors = require('cors')
const fs = require('fs')
const {initDatabase} = require('./backend/db')
const productRoutes = require('./backend/routes/productRoutes')
const paymentRoutes = require('./backend/routes/payment')
const authRoutes = require('./backend/routes/auth')
const adminRoutes = require('./backend/routes/admin')
const previewRoutes = require('./backend/routes/preview')
const storageRoutes = require('./backend/routes/storage')
const emailRoutes = require('./backend/routes/email')
const delhiveryRoutes = require('./backend/routes/delhivery')

const app = express()
const PORT = process.env.PORT || 3000

initDatabase()
const db = require('./backend/db').getDb()

const cacheControl = (maxAge, staleWhileRevalidate = maxAge) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`)
  next()
}

app.use(cors())
app.use(express.json({limit: '10mb'}))
app.use(express.urlencoded({extended: true, limit: '10mb'}))

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})

const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {recursive: true})

app.use('/uploads', cacheControl(31536000), express.static(uploadDir))

app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    rows.forEach(r => {
      try {
        settings[r.key] = JSON.parse(r.value)
      } catch {
        settings[r.key] = r.value
      }
    })
    // Ensure desktop and mobile hero images are guaranteed
    if (settings.hero_image && !settings.hero_image_pc) {
      settings.hero_image_pc = settings.hero_image
    }
    if (settings.hero_image_pc && !settings.hero_image_mobile) {
      settings.hero_image_mobile = settings.hero_image_pc
    }
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.json(settings)
  } catch (e) {
    res.status(500).json({error: e.message})
  }
})

app.use('/api/products', cacheControl(30, 60), productRoutes(db))
app.use('/api/auth', authRoutes(db))
app.use('/api/admin', adminRoutes(db))
app.use('/api/preview', previewRoutes(db))
app.use('/api/storage', storageRoutes(db))
app.use('/api/email', emailRoutes(db))
app.use('/api/delhivery', delhiveryRoutes(db))

const {createOrder, verify} = paymentRoutes(db)
app.post('/api/payment/order', createOrder)
app.post('/api/payment/verify', verify)
app.get('/api/health', (req, res) => res.json({status: 'ok', razorpay: true, ai: true, auth: true, admin: true, r2: true, email: true, delhivery: true}))

const distDir = fs.existsSync(path.join(__dirname, 'confelion-frontend', 'dist'))
  ? path.join(__dirname, 'confelion-frontend', 'dist')
  : fs.existsSync(path.join(__dirname, 'dist'))
    ? path.join(__dirname, 'dist')
    : path.join(__dirname, 'build')

if (process.env.NODE_ENV === 'production' || fs.existsSync(distDir)) {
  const assetsDir = path.join(distDir, 'assets')
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', cacheControl(31536000), express.static(assetsDir))
  }
  app.use(express.static(distDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400')
      }
    }
  }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next()
    const indexPath = path.join(distDir, 'index.html')
    if (fs.existsSync(indexPath)) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.sendFile(indexPath)
    }
    next()
  })
}

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on 0.0.0.0:${PORT}`))
