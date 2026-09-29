import { PRODUCTS_DATA, STORE_SETTINGS, CUSTOMERS_DATA } from '../data/mockData.js'
import { 
  syncSettingsToFirestore, 
  fetchSettingsFromFirestore, 
  createFirestoreOrder, 
  fetchFirestoreOrders,
  saveProductToFirestore,
  fetchFirestoreProducts,
  deleteFirestoreProduct,
  updateFirestoreProductStock
} from './firebase.js'
import { sendOrderConfirmationEmail } from './emailService.js'

export const API_BASE = ''

const CATALOG_STORAGE_VERSION = 'v2_real_apparel_photos';

export function getDeletedProductHandles() {
  try {
    const list = JSON.parse(localStorage.getItem('confelion_deleted_products') || '[]');
    const set = new Set(Array.isArray(list) ? list.map(x => String(x).toLowerCase().trim()) : []);
    set.add('new-product-xxys');
    set.add('new product xxys');
    set.add('new-product-xxyy');
    set.add('new product xxyy');
    return set;
  } catch {
    const set = new Set();
    set.add('new-product-xxys');
    set.add('new product xxys');
    set.add('new-product-xxyy');
    set.add('new product xxyy');
    return set;
  }
}

export function isProductDeleted(p, deletedSet = null) {
  if (!p) return true;
  if (p.is_deleted === true || p.published === false || p.published === 0) return true;
  const deleted = deletedSet || getDeletedProductHandles();
  const handle = String(p.handle || '').toLowerCase().trim();
  const id = String(p.id || '').toLowerCase().trim();
  const title = String(p.title || '').toLowerCase().trim();
  if (handle && deleted.has(handle)) return true;
  if (id && deleted.has(id)) return true;
  if (title && deleted.has(title)) return true;
  if (handle.includes('xxys') || handle.includes('xxyy') ||
      title.includes('xxys') || title.includes('xxyy') ||
      id.includes('xxys') || id.includes('xxyy')) {
    return true;
  }
  return false;
}

export function markProductDeleted(handleOrIdOrProd) {
  if (!handleOrIdOrProd) return;
  try {
    const set = getDeletedProductHandles();
    if (typeof handleOrIdOrProd === 'object') {
      if (handleOrIdOrProd.handle) set.add(String(handleOrIdOrProd.handle).toLowerCase().trim());
      if (handleOrIdOrProd.id) set.add(String(handleOrIdOrProd.id).toLowerCase().trim());
      if (handleOrIdOrProd.title) set.add(String(handleOrIdOrProd.title).toLowerCase().trim());
    } else {
      set.add(String(handleOrIdOrProd).toLowerCase().trim());
    }
    localStorage.setItem('confelion_deleted_products', JSON.stringify(Array.from(set)));

    // Clean up local stored products
    const local = localStorage.getItem('confelion_products');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(p => !isProductDeleted(p, set));
          localStorage.setItem('confelion_products', JSON.stringify(cleaned));
        }
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('products-updated'));
    }
  } catch {}
}

export function unmarkProductDeleted(handleOrId) {
  if (!handleOrId) return;
  try {
    const set = getDeletedProductHandles();
    set.delete(String(handleOrId).toLowerCase().trim());
    localStorage.setItem('confelion_deleted_products', JSON.stringify(Array.from(set)));
  } catch {}
}

// Complete dashboard & catalog purge to fresh blank slate
if (typeof window !== 'undefined') {
  try {
    const isPurged = localStorage.getItem('confelion_purged_clean_slate_v2');
    if (!isPurged) {
      localStorage.setItem('confelion_purged_clean_slate_v2', 'true');
      localStorage.setItem('confelion_products', '[]');
      localStorage.setItem('confelion_orders', '[]');
      localStorage.setItem('confelion_customers', '[]');
      localStorage.removeItem('confelion_vip_subscribers');
      localStorage.removeItem('confelion_cart');
    }
  } catch {}
}

// Helper to get or initialize stored products
export function getStoredProducts() {
  const deleted = getDeletedProductHandles();
  try {
    const local = localStorage.getItem('confelion_products');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed.filter(p => !isProductDeleted(p, deleted));
      }
    }
  } catch {}
  return [];
}

export function saveStoredProducts(prods) {
  const deleted = getDeletedProductHandles();
  const clean = (prods || []).filter(p => !isProductDeleted(p, deleted));
  localStorage.setItem('confelion_products', JSON.stringify(clean));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('products-updated', { detail: clean }));
  }
}

// Remote products synchronization from Backend Server & Firestore
if (typeof window !== 'undefined') {
  // 1. Sync from Express backend SQLite database or Vercel serverless catalog
  fetch('/api/products')
    .then(r => (r.ok ? r.json() : []))
    .then(serverProds => {
      if (Array.isArray(serverProds) && serverProds.length > 0) {
        const deleted = getDeletedProductHandles();
        const current = getStoredProducts();
        const map = new Map();
        // Preserve any custom edited products from admin first!
        current.forEach(p => {
          if (!isProductDeleted(p, deleted)) {
            map.set(p.handle || p.id, p);
          }
        });
        serverProds.forEach(p => {
          const key = p.handle || p.id;
          if (!isProductDeleted(p, deleted)) {
            if (!map.has(key)) {
              map.set(key, p);
            }
          }
        });
        const merged = Array.from(map.values()).filter(p => !isProductDeleted(p, deleted));
        saveStoredProducts(merged);
      }
    })
    .catch(() => {});

  // 2. Sync from Firestore if available
  fetchFirestoreProducts().then((remoteProds) => {
    if (Array.isArray(remoteProds) && remoteProds.length > 0) {
      const deleted = getDeletedProductHandles();
      const current = getStoredProducts();
      const map = new Map();
      current.forEach(p => {
        if (!isProductDeleted(p, deleted)) {
          map.set(p.handle || p.id, p);
        }
      });
      remoteProds.forEach(p => {
        const key = p.handle || p.id;
        if (!isProductDeleted(p, deleted)) {
          map.set(key, { ...map.get(key), ...p });
        }
      });
      const merged = Array.from(map.values()).filter(p => !isProductDeleted(p, deleted));
      saveStoredProducts(merged);
    }
  }).catch(() => {});
}

// Helper to get or initialize stored settings
export function getStoredSettings() {
  try {
    const local = localStorage.getItem('confelion_settings')
    if (local) {
      const parsed = JSON.parse(local)
      return { ...STORE_SETTINGS, ...parsed }
    }
  } catch {}
  localStorage.setItem('confelion_settings', JSON.stringify(STORE_SETTINGS))
  return STORE_SETTINGS
}

export function saveStoredSettings(s) {
  localStorage.setItem('confelion_settings', JSON.stringify(s))
  if (s.reels_data && Array.isArray(s.reels_data)) {
    localStorage.setItem('confelion_reels', JSON.stringify(s.reels_data))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('reels-updated', { detail: s.reels_data }))
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: s }))
  }
  // Sync to Cloud Firestore
  syncSettingsToFirestore(s).catch(() => {})
  // Sync to backend Express server / SQLite
  if (typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('token') || ''
      fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ settings: s })
      }).catch(() => {})
    } catch {}
  }
}

// Remote backend and cloud settings synchronization
if (typeof window !== 'undefined') {
  // 1. Fetch live settings and reels from Express backend SQLite database
  fetch('/api/settings')
    .then(r => (r.ok ? r.json() : null))
    .then(serverSettings => {
      if (serverSettings && typeof serverSettings === 'object' && Object.keys(serverSettings).length > 0) {
        const current = getStoredSettings()
        const merged = { ...current, ...serverSettings }
        localStorage.setItem('confelion_settings', JSON.stringify(merged))
        if (serverSettings.reels_data && Array.isArray(serverSettings.reels_data) && serverSettings.reels_data.length > 0) {
          localStorage.setItem('confelion_reels', JSON.stringify(serverSettings.reels_data))
          window.dispatchEvent(new CustomEvent('reels-updated', { detail: serverSettings.reels_data }))
        }
        window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }))
      }
    })
    .catch(() => {})

  // 2. Fallback to Firestore if configured
  fetchSettingsFromFirestore().then((remote) => {
    if (remote) {
      const current = getStoredSettings()
      const merged = { ...current, ...remote }
      localStorage.setItem('confelion_settings', JSON.stringify(merged))
      if (remote.reels_data && Array.isArray(remote.reels_data) && remote.reels_data.length > 0) {
        localStorage.setItem('confelion_reels', JSON.stringify(remote.reels_data))
        window.dispatchEvent(new CustomEvent('reels-updated', { detail: remote.reels_data }))
      }
      window.dispatchEvent(new CustomEvent('settings-updated', { detail: merged }))
    }
  }).catch(() => {})
}

// Helper to get or initialize stored orders
export function getStoredOrders() {
  try {
    const local = localStorage.getItem('confelion_orders')
    if (local) return JSON.parse(local)
  } catch {}
  return []
}

export function saveStoredOrders(orders) {
  localStorage.setItem('confelion_orders', JSON.stringify(orders))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('orders-updated', { detail: orders }))
  }
}

// Helper to get or initialize stored customers
export function getStoredCustomers() {
  try {
    const local = localStorage.getItem('confelion_customers')
    if (local) {
      const parsed = JSON.parse(local)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {}
  return []
}

export function saveStoredCustomers(customers) {
  localStorage.setItem('confelion_customers', JSON.stringify(customers))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('customers-updated', { detail: customers }))
  }
}

export async function fetchAPI(path, options = {}) {
  // Simulate network latency (15-30ms)
  await new Promise(r => setTimeout(r, 20))

  const cleanPath = path.split('?')[0]
  const queryString = path.includes('?') ? path.split('?')[1] : ''
  const searchParams = new URLSearchParams(queryString)
  const method = (options.method || 'GET').toUpperCase()

  let body = {}
  try {
    body = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {})
  } catch {}

  // 1. Auth endpoints disabled locally: Google Firebase Authentication is the sole authority
  if (cleanPath === '/api/auth/login' || cleanPath === '/api/auth/signup' || cleanPath.startsWith('/api/auth/otp/')) {
    return { error: 'Authentication is managed exclusively via Google Firebase Authentication.' }
  }

  // 1c. Customer Profile: GET /api/customer/profile, PUT /api/customer/profile
  if (cleanPath === '/api/customer/profile') {
    let email = searchParams.get('email')
    if (!email) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        email = u.email
      } catch {}
    }
    let customers = getStoredCustomers()
    let cust = customers.find(c => c.email && c.email.toLowerCase() === (email || '').toLowerCase())

    if (method === 'PUT' || method === 'POST') {
      if (cust) {
        cust = { ...cust, ...body }
        const updated = customers.map(c => c.id === cust.id ? cust : c)
        saveStoredCustomers(updated)
      } else {
        cust = {
          id: 'cust_' + Date.now(),
          email: email || body.email,
          name: body.name || 'Confelion Patron',
          ...body,
          role: 'customer'
        }
        customers.push(cust)
        saveStoredCustomers(customers)
      }
      try {
        const currUser = JSON.parse(localStorage.getItem('user') || '{}')
        if (currUser && currUser.email && currUser.email.toLowerCase() === cust.email.toLowerCase()) {
          localStorage.setItem('user', JSON.stringify({ ...currUser, ...cust }))
        }
      } catch {}
      return { success: true, customer: cust }
    }

    if (!cust) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        if (u && u.email) {
          cust = {
            id: u.id || 'cust_' + Date.now(),
            name: u.name || 'Confelion Patron',
            email: u.email,
            phone: u.phone || '',
            city: u.city || 'Mumbai, MH',
            address: u.address || '',
            status: u.status || 'Active Member',
            joined_date: u.joined_date || new Date().toISOString().split('T')[0],
            role: 'customer'
          }
        }
      } catch {}
    }
    return cust || { error: 'Customer not found' }
  }

  // 1d. Customer Orders: GET /api/customer/orders
  if (cleanPath === '/api/customer/orders') {
    let email = searchParams.get('email')
    let userId = searchParams.get('userId') || searchParams.get('user_id')
    if (!email && !userId) {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}')
        email = u.email
        userId = u.id
      } catch {}
    }
    if (!email && !userId) {
      return []
    }
    const allOrders = getStoredOrders()
    const targetEmail = email ? email.toLowerCase().trim() : null
    const filtered = allOrders.filter(o => {
      const matchEmail = targetEmail && o.email && o.email.toLowerCase().trim() === targetEmail
      const matchId = userId && o.user_id && o.user_id === userId
      return matchEmail || matchId
    })
    return filtered
  }

  // 2. Auth Session Check: /api/auth/me
  if (cleanPath === '/api/auth/me') {
    try {
      const savedUser = localStorage.getItem('user')
      if (savedUser) return JSON.parse(savedUser)
    } catch {}
    return { error: 'Not authenticated' }
  }

  // 3. Settings Endpoints: /api/settings or /api/admin/settings
  if (cleanPath === '/api/settings' || cleanPath === '/api/admin/settings') {
    if (method === 'POST' || method === 'PUT') {
      const current = getStoredSettings()
      const incoming = (body && body.settings && typeof body.settings === 'object') ? body.settings : (body || {})
      const updated = { ...current, ...incoming }
      saveStoredSettings(updated)
      return updated
    }
    return getStoredSettings()
  }

  // 4. Admin Revenue Stats: /api/admin/revenue
  if (cleanPath === '/api/admin/revenue') {
    const orders = getStoredOrders()
    const totalRev = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0)
    return {
      period: searchParams.get('period') || 'month',
      totalRevenue: totalRev,
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? Math.round(totalRev / orders.length) : 0,
      growth: orders.length > 0 ? '+18.4%' : '0.0%',
      recentSales: [],
    }
  }

  // 5. Place New Order from Storefront Checkout: POST /api/orders
  if (cleanPath === '/api/orders' && method === 'POST') {
    let orders = getStoredOrders()
    const orderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000)

    const newOrder = {
      id: orderId,
      user_id: body.user_id || null,
      customer_name: body.customer_name || 'Valued Patron',
      email: (body.email || '').toLowerCase().trim(),
      phone: body.phone || '',
      shipping_address: body.shipping_address || '',
      city: body.city || '',
      pincode: body.pincode || '',
      items: body.items || [],
      items_count: (body.items || []).reduce((s, i) => s + (i.qty || 1), 0),
      subtotal: Number(body.subtotal) || Number(body.total) || 0,
      cod_fee: Number(body.cod_fee) || 0,
      total: Number(body.total) || 0,
      payment_method: body.payment_method || 'Full Online Payment',
      payment_details: body.payment_details || {},
      status: 'Processing',
      carrier: 'Delhivery Express',
      awb_number: '17898' + Math.floor(100000000 + Math.random() * 900000000),
      tracking_url: null,
      origin_facility: 'Poonchh Fulfillment Hub (284304)',
      estimated_delivery: '2-4 business days',
      created_at: new Date().toISOString(),
    }

    if (newOrder.awb_number) {
      newOrder.tracking_url = `https://www.delhivery.com/track/package/${newOrder.awb_number}`
    }

    orders = [newOrder, ...orders]
    saveStoredOrders(orders)
    createFirestoreOrder(newOrder).catch(() => {})
    sendOrderConfirmationEmail(newOrder).catch(() => {})

    // Sync with Delhivery logistics API in background
    fetchAPI('/api/delhivery/order', {
      method: 'POST',
      body: JSON.stringify({
        order_id: newOrder.id,
        awb: newOrder.awb_number,
        customer: newOrder
      })
    }).catch(() => {})

    // Decrement inventory of ordered products
    if (Array.isArray(body.items) && body.items.length > 0) {
      let prods = getStoredProducts()
      body.items.forEach(item => {
        prods = prods.map(p => {
          if (p.handle === item.handle || p.id === item.id) {
            const currentInv = p.inventory !== undefined ? Number(p.inventory) : 15
            const newInv = Math.max(0, currentInv - (item.qty || 1))
            return { ...p, inventory: newInv }
          }
          return p
        })
      })
      saveStoredProducts(prods)
    }

    // Update or insert into customers roster
    if (body.customer_name && body.email) {
      let customers = getStoredCustomers()
      const existingIndex = customers.findIndex(c => c.email.toLowerCase() === body.email.toLowerCase())
      if (existingIndex > -1) {
        const existing = customers[existingIndex]
        customers[existingIndex] = {
          ...existing,
          name: body.customer_name || existing.name,
          phone: body.phone || existing.phone,
          city: body.city || existing.city,
          address: body.shipping_address || existing.address,
          total_orders: (existing.total_orders || 1) + 1,
          total_spent: (Number(existing.total_spent) || 0) + Number(body.total || 0),
          last_order_date: new Date().toISOString().slice(0, 10),
        }
      } else {
        const newCustomer = {
          id: 'cust-' + Math.floor(100 + Math.random() * 900),
          name: body.customer_name,
          email: body.email,
          phone: body.phone || '',
          city: body.city || 'India',
          address: body.shipping_address || '',
          total_orders: 1,
          total_spent: Number(body.total || 0),
          status: Number(body.total || 0) > 6000 ? 'VIP' : 'Active',
          joined_date: new Date().toISOString().slice(0, 10),
          last_order_date: new Date().toISOString().slice(0, 10),
        }
        customers = [newCustomer, ...customers]
      }
      saveStoredCustomers(customers)
    }

    return { success: true, order: newOrder }
  }

  // 6. Admin Orders: /api/admin/orders
  if (cleanPath === '/api/admin/orders') {
    return getStoredOrders()
  }

  // 7. Admin Order Status Update: /api/admin/orders/:id/status or /api/admin/orders/:id
  if (cleanPath.startsWith('/api/admin/orders/') && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
    const parts = cleanPath.split('/')
    const orderId = parts[4] || parts[3]
    let orders = getStoredOrders()
    orders = orders.map(o => {
      if (o.id === orderId) {
        return { ...o, status: body.status || o.status }
      }
      return o
    })
    saveStoredOrders(orders)
    return { success: true, orderId, status: body.status }
  }

  // 8. Admin Customers: /api/admin/customers
  if (cleanPath === '/api/admin/customers') {
    let customers = getStoredCustomers()
    const q = searchParams.get('q')
    if (q) {
      const lower = q.toLowerCase()
      customers = customers.filter(c => 
        (c.name && c.name.toLowerCase().includes(lower)) ||
        (c.email && c.email.toLowerCase().includes(lower)) ||
        (c.phone && c.phone.toLowerCase().includes(lower)) ||
        (c.city && c.city.toLowerCase().includes(lower))
      )
    }
    return customers
  }

  // 9. Admin Users: /api/admin/users
  if (cleanPath === '/api/admin/users') {
    return [
      { id: 1, name: 'Confelion Admin', email: 'admin.confelion@gmail.com', role: 'admin', created_at: '2026-08-01' },
      { id: 2, name: 'Aditya Verma', email: 'aditya.v@gmail.com', role: 'customer', created_at: '2026-04-12' },
      { id: 3, name: 'Rohan Sharma', email: 'rohan.sharma99@gmail.com', role: 'customer', created_at: '2026-06-20' },
      { id: 4, name: 'Zaid Khan', email: 'zaid.khan@outlook.com', role: 'customer', created_at: '2026-05-15' },
    ]
  }

  // 10. Single Product Detail: /api/products/:handle
  if (cleanPath.startsWith('/api/products/')) {
    const handle = cleanPath.replace('/api/products/', '')
    
    // 1. Try direct fetch from backend Express server
    if (typeof window !== 'undefined') {
      try {
        const serverRes = await fetch(`/api/products/${encodeURIComponent(handle)}`)
        if (serverRes.ok) {
          const serverJson = await serverRes.json()
          if (serverJson && serverJson.product) {
            return serverJson
          }
        }
      } catch {}
    }

    // 2. Lookup in stored products or PRODUCTS_DATA
    const prods = getStoredProducts()
    let product = prods.find(p => p.handle === handle || String(p.id) === String(handle))
    if (!product) {
      product = PRODUCTS_DATA.find(p => p.handle === handle || String(p.id) === String(handle))
    }
    if (!product && prods.length > 0) {
      product = prods[0]
    }
    if (!product) {
      return { error: 'Product not found' }
    }
    
    return {
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: product.price,
        compare_at_price: product.compare_at_price,
        description: product.description,
        type: product.type,
        category: product.category,
        tags: Array.isArray(product.tags) ? product.tags.join(', ') : (product.tags || ''),
        image_url: product.image_url,
        light_image: product.image_url,
        size_chart_image: product.size_chart_image || '',
        size_chart_table: product.size_chart_table || null,
        inventory: product.inventory ?? 15,
      },
      productImages: (product.images || [product.image_url]).map((img, idx) => ({
        id: idx + 1,
        image_url: img,
        position: idx + 1,
      })),
      variants: (product.sizes || ['S', 'M', 'L', 'XL', 'XXL']).map((size, idx) => ({
        id: idx + 1,
        title: size,
        price: product.price,
        compare_at_price: product.compare_at_price,
        inventory_quantity: product.inventory ?? 15,
        sku: `${(product.handle || 'PROD').toUpperCase()}-${size}`,
      })),
      options: [
        {
          id: 1,
          name: 'Size',
          value: (product.sizes || ['S', 'M', 'L', 'XL', 'XXL']).join(', '),
        },
      ],
      details: product.details || [],
    }
  }

  // 11. Admin Update Existing Product: PUT /api/admin/products/:handle
  if (cleanPath.startsWith('/api/admin/products/') && method === 'PUT') {
    const handle = cleanPath.replace('/api/admin/products/', '')
    unmarkProductDeleted(handle)
    let prods = getStoredProducts()
    const idx = prods.findIndex(p => p.handle === handle || p.id === handle)
    if (idx > -1) {
      prods[idx] = {
        ...prods[idx],
        ...body,
        price: Number(body.price) || prods[idx].price,
        compare_at_price: body.compare_at_price ? Number(body.compare_at_price) : null,
        inventory: body.qty !== undefined ? Number(body.qty) : (body.inventory !== undefined ? Number(body.inventory) : prods[idx].inventory),
        images: Array.isArray(body.images) && body.images.length > 0 ? body.images : prods[idx].images,
        image_url: body.image_url || (body.images && body.images[0]) || prods[idx].image_url,
        secondary_image: body.secondary_image || (body.images && body.images[1]) || prods[idx].secondary_image || '',
        size_chart_image: body.size_chart_image !== undefined ? body.size_chart_image : (prods[idx].size_chart_image || ''),
        size_chart_table: body.size_chart_table !== undefined ? body.size_chart_table : (prods[idx].size_chart_table || null),
        sizes: typeof body.size === 'string' ? body.size.split(',').map(s => s.trim()).filter(Boolean) : (body.sizes || prods[idx].sizes),
        details: Array.isArray(body.details) ? body.details : (typeof body.details === 'string' ? body.details.split('\n').filter(Boolean) : prods[idx].details),
      }
      saveStoredProducts(prods)
      saveProductToFirestore(prods[idx]).catch(() => {})
      try {
        const token = localStorage.getItem('token') || ''
        fetch(`/api/admin/products/${handle}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify(body)
        }).catch(() => {})
      } catch {}
      return prods[idx]
    }
    return { error: 'Product not found' }
  }

  // 12. Admin Delete Product: DELETE /api/admin/products/:handle
  if (cleanPath.startsWith('/api/admin/products/') && method === 'DELETE') {
    const handle = cleanPath.replace('/api/admin/products/', '')
    markProductDeleted(handle)
    let prods = getStoredProducts()
    prods = prods.filter(p => p.handle !== handle && p.id !== handle)
    saveStoredProducts(prods)
    deleteFirestoreProduct(handle).catch(() => {})
    try {
      const token = localStorage.getItem('token') || ''
      fetch(`/api/admin/products/${handle}`, {
        method: 'DELETE',
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      }).catch(() => {})
    } catch {}
    return { success: true, message: `Deleted ${handle}` }
  }

  // 13. Products List & Admin Product Add: /api/products or /api/admin/products
  if (cleanPath === '/api/products' || cleanPath === '/api/admin/products') {
    let prods = getStoredProducts()

    // Handle POST: Add new product
    if (method === 'POST') {
      const generatedHandle = body.handle || (body.title ? body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'new-drop-' + Date.now())
      unmarkProductDeleted(generatedHandle)
      const newProd = {
        id: 'prod-' + Date.now(),
        handle: generatedHandle,
        title: body.title || 'New All Black Silhouette',
        category: body.category || 'Shirts',
        type: body.type || 'shirt',
        price: Number(body.price) || 1999,
        compare_at_price: body.compare_at_price ? Number(body.compare_at_price) : null,
        rating: 5.0,
        reviews_count: 1,
        is_recent_drop: true,
        is_bestseller: false,
        image_url: body.image_url || (body.images && body.images[0]) || '/images/product-placeholder.svg',
        secondary_image: body.secondary_image || (body.images && body.images[1]) || '',
        images: Array.isArray(body.images) && body.images.length > 0 ? body.images : [body.image_url || '/images/product-placeholder.svg'],
        sizes: typeof body.size === 'string' ? body.size.split(',').map(s => s.trim()).filter(Boolean) : (body.sizes || ['S', 'M', 'L', 'XL', 'XXL']),
        description: body.description || 'Exclusive all-black release crafted from heavyweight combed cotton.',
        details: Array.isArray(body.details) ? body.details : (typeof body.details === 'string' ? body.details.split('\n').filter(Boolean) : ['100% Heavyweight Cotton', 'Reverse wash only']),
        inventory: Number(body.qty) || Number(body.inventory) || 15,
        size_chart_image: body.size_chart_image || '',
        size_chart_table: body.size_chart_table || null,
      }
      prods = [newProd, ...prods]
      saveStoredProducts(prods)
      saveProductToFirestore(newProd).catch(() => {})
      try {
        const token = localStorage.getItem('token') || ''
        fetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify(body)
        }).catch(() => {})
      } catch {}
      return newProd
    }

    // Filter & Search
    let result = [...prods]
    const q = searchParams.get('q')
    if (q) {
      const lower = q.toLowerCase()
      result = result.filter(p => 
        (p.title && p.title.toLowerCase().includes(lower)) || 
        (p.description && p.description.toLowerCase().includes(lower)) ||
        (p.category && p.category.toLowerCase().includes(lower)) ||
        (p.handle && p.handle.toLowerCase().includes(lower))
      )
    }

    const type = searchParams.get('type')
    if (type) {
      result = result.filter(p => p.type && p.type.toLowerCase() === type.toLowerCase())
    }

    const category = searchParams.get('category')
    if (category) {
      result = result.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase())
    }

    const sort = searchParams.get('sort')
    if (sort === 'price_asc') {
      result.sort((a, b) => a.price - b.price)
    } else if (sort === 'price_desc') {
      result.sort((a, b) => b.price - a.price)
    }

    return result
  }

  // 14. Admin Update Stock: /api/admin/variants/:id/stock or /api/admin/products/:handle/stock
  if (cleanPath.includes('/stock') && (method === 'PUT' || method === 'POST')) {
    const qty = Number(body.qty ?? body.inventory_quantity ?? 10)
    let prods = getStoredProducts()
    let matchedHandle = null
    prods = prods.map(p => {
      if (cleanPath.includes(p.handle) || cleanPath.includes(p.id)) {
        matchedHandle = p.handle || p.id
        return { ...p, inventory: qty }
      }
      return p
    })
    saveStoredProducts(prods)
    if (matchedHandle) {
      updateFirestoreProductStock(matchedHandle, qty).catch(() => {})
      try {
        const token = localStorage.getItem('token') || ''
        fetch(`/api/admin/products/${matchedHandle}/stock`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
          body: JSON.stringify({ inventory_quantity: qty })
        }).catch(() => {})
      } catch {}
    }
    return { success: true, qty }
  }

  // 15. Reset Products to Factory Defaults: /api/admin/products/reset
  if (cleanPath === '/api/admin/products/reset' && method === 'POST') {
    saveStoredProducts(PRODUCTS_DATA)
    return { success: true, count: PRODUCTS_DATA.length }
  }

  // 16. DELHIVERY ONE LOGISTICS ENDPOINTS
  // 16a. Pincode Serviceability
  if (cleanPath.startsWith('/api/delhivery/serviceability/')) {
    const pincode = cleanPath.split('/')[4] || ''
    try {
      const res = await fetch(`/api/delhivery/serviceability/${pincode}`)
      if (res.ok) return await res.json()
    } catch {}

    // Standalone fallback
    const pin = String(pincode).trim()
    const valid = /^[1-9][0-9]{5}$/.test(pin)
    if (!valid) {
      return { serviceable: false, pincode: pin, error: 'Please enter a valid 6-digit PIN code.' }
    }
    const prefix = pin.slice(0, 2)
    // Dispatch is guaranteed at least 5 days from current date
    const minDays = 5
    const maxDays = ['28', '11', '12', '13', '20', '21', '22', '40'].includes(prefix) ? 7 : 8
    const d1 = new Date(); d1.setDate(d1.getDate() + minDays)
    const d2 = new Date(); d2.setDate(d2.getDate() + maxDays)
    const fmt = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

    return {
      serviceable: true,
      pincode: pin,
      carrier: 'Delhivery Express',
      origin_pincode: '284304',
      origin_facility: 'confelion',
      estimated_days: `${minDays}-${maxDays} business days`,
      estimated_delivery_text: `Delivery between ${fmt(d1)} - ${fmt(d2)}`,
      cod_available: true,
      prepaid_available: true,
      free_delivery_threshold: 999,
      standard_shipping_fee: 50
    }
  }

  // 16b. Calculate Shipping Rates
  if (cleanPath === '/api/delhivery/rates') {
    try {
      const res = await fetch('/api/delhivery/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) return await res.json()
    } catch {}

    const isFree = Number(body.subtotal || 0) >= 999
    return {
      success: true,
      carrier: 'Delhivery Express',
      freight_charge: isFree ? 0 : 50,
      cod_charge: body.payment_mode === 'COD' ? 99 : 0,
      total_shipping: isFree ? (body.payment_mode === 'COD' ? 99 : 0) : (body.payment_mode === 'COD' ? 149 : 50),
      free_shipping_unlocked: isFree
    }
  }

  // 16c. Live Tracking by AWB
  if (cleanPath.startsWith('/api/delhivery/track/')) {
    const awb = cleanPath.split('/')[4] || ''
    try {
      const res = await fetch(`/api/delhivery/track/${awb}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.success) return data
      }
    } catch {}

    return {
      success: true,
      awb_number: awb,
      carrier: 'Delhivery Express',
      delivery_status: 'Manifested - Awaiting Delhivery Pickup',
      tracking_url: 'https://www.delhivery.com/',
      origin: 'Poonchh Hub, UP (284304)',
      destination: 'Destination Facility',
      expected_delivery_date: '2-4 Business Days',
      timeline: [],
      scans: []
    }
  }

  // 16d. Admin Delhivery Wallet
  if (cleanPath === '/api/delhivery/wallet') {
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/delhivery/wallet', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) return await res.json()
    } catch {}

    return {
      success: true,
      current_balance: 42.68,
      minimum_threshold: 0.0,
      maximum_threshold: 0.0,
      is_active: true,
      payment_gateway: 'paytm'
    }
  }

  // 16e. Admin Delhivery Warehouses
  if (cleanPath === '/api/delhivery/warehouses') {
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/delhivery/warehouses', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) return await res.json()
    } catch {}

    return {
      success: true,
      total: 2,
      warehouses: [
        {
          facility_id: 'eb306f25-ada2-4384-bdb3-d9eec59e5ff6',
          facility_name: 'confelion',
          status: 'ACTIVE',
          city: 'Poonchh',
          state: 'Uttar Pradesh',
          pin_code: '284304',
          contact_person: 'manish prajapati',
          phone: '+916392411276',
          address_line1: 'nai basti samthar kumhryanu'
        },
        {
          facility_id: '1dca5831-77c2-44d2-83c0-eb38f627a334',
          facility_name: 'wearhouse',
          status: 'ACTIVE',
          city: 'Poonchh',
          state: 'Uttar Pradesh',
          pin_code: '284304',
          contact_person: 'manish prajapati',
          phone: '+916392411276',
          address_line1: 'nai basti samthar kumhryanu'
        }
      ]
    }
  }

  // 16f. Admin Delhivery Orders
  if (cleanPath === '/api/delhivery/orders') {
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/delhivery/orders', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
      if (res.ok) return await res.json()
    } catch {}

    return {
      success: true,
      total: 19,
      orders: [
        { id: '2265823f-af60-11f1-adf1-96ffb5052ad1', shipment_status: 'DELIVERED', box_count: 1 },
        { id: 'd201bd9e-af5b-11f1-adf1-96ffb5052ad1', shipment_status: 'DELIVERED', box_count: 1 },
        { id: '1020ba51-e62e-4616-b9e7-1a43b90b5b92', shipment_status: 'AWAITING_LABEL', box_count: 1 },
        { id: '795a5d50-1810-4540-9bd3-84c4dc27e7a3', shipment_status: 'DELIVERED', box_count: 1 },
        { id: '1e549620-aac4-4364-9a86-f1c218ce24c0', shipment_status: 'DELIVERED', box_count: 1 }
      ]
    }
  }

  // 16g. Admin Dispatch Shipment with Delhivery
  if (cleanPath === '/api/delhivery/shipment/create' && method === 'POST') {
    const token = localStorage.getItem('token') || ''
    try {
      const res = await fetch('/api/delhivery/shipment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const data = await res.json()
        let orders = getStoredOrders()
        orders = orders.map(o => {
          if (o.id === body.order_id) {
            return {
              ...o,
              status: 'In Transit',
              carrier: 'Delhivery Express',
              awb_number: data.awb_number,
              tracking_url: data.tracking_url || 'https://www.delhivery.com/'
            }
          }
          return o
        })
        saveStoredOrders(orders)
        return data
      }
    } catch {}

    const awb = '17898' + Math.floor(100000000 + Math.random() * 900000000)
    let orders = getStoredOrders()
    orders = orders.map(o => {
      if (o.id === body.order_id) {
        return {
          ...o,
          status: 'In Transit',
          carrier: 'Delhivery Express',
          awb_number: awb,
          tracking_url: 'https://www.delhivery.com/'
        }
      }
      return o
    })
    saveStoredOrders(orders)
    return {
      success: true,
      order_id: body.order_id,
      awb_number: awb,
      carrier: 'Delhivery Express',
      warehouse: body.warehouse || 'confelion',
      tracking_url: 'https://www.delhivery.com/'
    }
  }

  return []
}

export function buildUrl(path, params = {}) {
  const url = new URL(path, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value)
    }
  })
  return url.pathname + url.search
}

// Convenient Delhivery Helper Functions
export async function checkDelhiveryPincode(pincode) {
  return fetchAPI(`/api/delhivery/serviceability/${pincode}`)
}

export async function trackDelhiveryAwb(awb) {
  return fetchAPI(`/api/delhivery/track/${awb}`)
}

export async function fetchDelhiveryWallet() {
  return fetchAPI('/api/delhivery/wallet')
}

export async function fetchDelhiveryWarehouses() {
  return fetchAPI('/api/delhivery/warehouses')
}

export async function fetchDelhiveryOrders() {
  return fetchAPI('/api/delhivery/orders')
}

export async function dispatchDelhiveryOrder(orderId, warehouse = 'confelion') {
  return fetchAPI('/api/delhivery/shipment/create', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, warehouse })
  })
}
