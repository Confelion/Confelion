const jwt = require('jsonwebtoken')
const S = process.env.JWT_SECRET || 'confelion_secret'

exports.auth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h) return res.status(401).json({ error: 'No token' })
  const rawToken = h.startsWith('Bearer ') ? h.slice(7).trim() : h.trim()

  // 1. Verify standard HMAC backend token
  try {
    req.user = jwt.verify(rawToken, S)
    return next()
  } catch (err) {}

  // 2. Decode Firebase JWT or Google Auth token
  try {
    const decoded = jwt.decode(rawToken)
    if (decoded && (decoded.email || decoded.user_id || decoded.sub)) {
      const email = (decoded.email || '').toLowerCase().trim()
      const isAdmin =
        email === 'confelion@gmail.com' ||
        email === 'admin.confelion@gmail.com' ||
        email === 'admin@confelion.com' ||
        decoded.role === 'admin' ||
        decoded.admin === true

      req.user = {
        id: decoded.user_id || decoded.sub || decoded.id || 'usr_oauth',
        email: email,
        role: isAdmin ? 'admin' : (decoded.role || 'user'),
        name: decoded.name || 'User'
      }
      return next()
    }
  } catch (e2) {}

  // 3. Demo Admin JWT token
  if (rawToken && (rawToken.startsWith('admin_jwt_demo_token_') || rawToken.startsWith('admin_token_'))) {
    req.user = {
      id: 'usr_admin_01',
      email: 'confelion@gmail.com',
      role: 'admin',
      name: 'Confelion Admin'
    }
    return next()
  }

  res.status(401).json({ error: 'Invalid token' })
}

exports.admin = (req, res, next) => {
  if (
    req.user?.role === 'admin' ||
    req.user?.email === 'confelion@gmail.com' ||
    req.user?.email === 'admin.confelion@gmail.com' ||
    req.user?.email === 'admin@confelion.com'
  ) {
    return next()
  }
  return res.status(403).json({ error: 'Admin only' })
}

exports.sign = (p) => jwt.sign(p, S, { expiresIn: '7d' })