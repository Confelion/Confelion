require('dotenv').config();
const crypto = require('crypto');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'paypertap-76218';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@paypertap-76218.iam.gserviceaccount.com';
let FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY || '';

// Clean private key formatting if loaded with escaped newlines
if (FIREBASE_PRIVATE_KEY.startsWith('"') && FIREBASE_PRIVATE_KEY.endsWith('"')) {
  FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.slice(1, -1);
}
FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Check if backend Firebase Service Account is configured
 */
function isFirebaseConfigured() {
  return Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);
}

/**
 * Mint and cache Google OAuth 2.0 Access Token for Datastore / Firestore API
 */
async function getAccessToken() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase service account credentials not configured in .env');
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(header + '.' + claim);
  const signature = sign.sign(FIREBASE_PRIVATE_KEY, 'base64url');
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google OAuth token exchange failed [${res.status}]: ${errText}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access_token returned by Google OAuth');
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (Number(data.expires_in) || 3600);
  return cachedAccessToken;
}

/**
 * Helper to encode standard JS object to Firestore Value format
 */
function toFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

/**
 * Helper to decode Firestore Value format to standard JS object
 */
function fromFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const obj = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      obj[k] = fromFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

/**
 * Save or update product in Firestore collection 'products'
 */
async function saveProductToFirestore(product) {
  try {
    const token = await getAccessToken();
    const docId = product.handle || product.id || `silhouette-${Date.now()}`;
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products/${encodeURIComponent(docId)}`;

    const fields = {
      id: toFirestoreValue(product.id || docId),
      handle: toFirestoreValue(product.handle || docId),
      title: toFirestoreValue(product.title || 'Untitled Silhouette'),
      price: toFirestoreValue(Number(product.price) || 0),
      compare_at_price: toFirestoreValue(product.compare_at_price ? Number(product.compare_at_price) : null),
      category: toFirestoreValue(product.category || 'Shirts'),
      type: toFirestoreValue(product.type || 'shirt'),
      inventory: toFirestoreValue(Number(product.inventory || product.qty || 15)),
      sizes: toFirestoreValue(Array.isArray(product.sizes) ? product.sizes : ['S', 'M', 'L', 'XL', 'XXL']),
      image_url: toFirestoreValue(product.image_url || ''),
      secondary_image: toFirestoreValue(product.secondary_image || product.image_url || ''),
      images: toFirestoreValue(Array.isArray(product.images) ? product.images : (product.image_url ? [product.image_url] : [])),
      description: toFirestoreValue(product.description || ''),
      details: toFirestoreValue(Array.isArray(product.details) ? product.details : ['100% Combed Cotton']),
      size_chart_image: toFirestoreValue(product.size_chart_image || ''),
      size_chart_table: toFirestoreValue(product.size_chart_table || null),
      published: toFirestoreValue(product.published !== undefined ? Boolean(product.published) : true),
      updated_at: { timestampValue: new Date().toISOString() }
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Firestore saveProduct warning]: ${err}`);
      return false;
    }

    const savedDoc = await res.json();
    console.info(`[Firestore] Successfully synced product "${docId}" to Firestore collection 'products'`);
    return true;
  } catch (e) {
    console.warn('[Firestore saveProduct note]:', e.message);
    return false;
  }
}

/**
 * Fetch all products from Firestore collection 'products'
 */
async function fetchFirestoreProducts() {
  try {
    const token = await getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=100`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    if (!data.documents || !Array.isArray(data.documents)) {
      return [];
    }

    return data.documents.map((doc) => {
      const parts = doc.name.split('/');
      const id = parts[parts.length - 1];
      const parsed = {};
      for (const [key, val] of Object.entries(doc.fields || {})) {
        parsed[key] = fromFirestoreValue(val);
      }
      return { id, ...parsed };
    });
  } catch (e) {
    console.warn('[Firestore fetchProducts note]:', e.message);
    return [];
  }
}

/**
 * Delete product from Firestore collection 'products'
 */
async function deleteFirestoreProduct(handleOrId) {
  try {
    const token = await getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products/${encodeURIComponent(handleOrId)}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.ok;
  } catch (e) {
    console.warn('[Firestore deleteProduct note]:', e.message);
    return false;
  }
}

/**
 * Update product inventory quantity in Firestore
 */
async function updateFirestoreProductStock(handleOrId, inventoryQuantity) {
  try {
    const token = await getAccessToken();
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products/${encodeURIComponent(handleOrId)}?updateMask.fieldPaths=inventory&updateMask.fieldPaths=updated_at`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          inventory: toFirestoreValue(Number(inventoryQuantity) || 0),
          updated_at: { timestampValue: new Date().toISOString() }
        }
      })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Firestore updateStock note]:', e.message);
    return false;
  }
}

/**
 * Record or sync customer order to Firestore collection 'orders'
 */
async function syncOrderToFirestore(order) {
  try {
    const token = await getAccessToken();
    const orderId = order.id || `ORD-${Date.now()}`;
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(orderId)}`;

    const fields = {
      id: toFirestoreValue(orderId),
      email: toFirestoreValue(order.email ? order.email.toLowerCase().trim() : ''),
      customer_name: toFirestoreValue(order.customer_name || order.name || 'Patron'),
      phone: toFirestoreValue(order.phone || ''),
      shipping_address: toFirestoreValue(order.shipping_address || order.address || ''),
      city: toFirestoreValue(order.city || ''),
      pincode: toFirestoreValue(order.pincode || ''),
      total: toFirestoreValue(Number(order.total || 0)),
      subtotal: toFirestoreValue(Number(order.subtotal || order.total || 0)),
      items_count: toFirestoreValue(Number(order.items_count || (order.items && order.items.length) || 1)),
      items: toFirestoreValue(order.items || []),
      payment_method: toFirestoreValue(order.payment_method || 'Online'),
      payment_details: toFirestoreValue(order.payment_details || {}),
      status: toFirestoreValue(order.status || 'Processing'),
      carrier: toFirestoreValue(order.carrier || 'Delhivery Express'),
      awb_number: toFirestoreValue(order.awb_number || order.payment_id || null),
      tracking_url: toFirestoreValue(order.tracking_url || 'https://www.delhivery.com/'),
      created_at: { timestampValue: order.created_at ? new Date(order.created_at).toISOString() : new Date().toISOString() },
      updated_at: { timestampValue: new Date().toISOString() }
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Firestore syncOrder note]:', e.message);
    return false;
  }
}

/**
 * Update order status and AWB in Firestore
 */
async function updateFirestoreOrderStatus(orderId, status, awbNumber = null) {
  try {
    const token = await getAccessToken();
    const paths = ['status', 'updated_at'];
    const fields = {
      status: toFirestoreValue(status),
      updated_at: { timestampValue: new Date().toISOString() }
    };

    if (awbNumber) {
      paths.push('awb_number', 'carrier', 'tracking_url');
      fields.awb_number = toFirestoreValue(awbNumber);
      fields.carrier = toFirestoreValue('Delhivery Express');
      fields.tracking_url = toFirestoreValue('https://www.delhivery.com/');
    }

    const maskParams = paths.map(p => `updateMask.fieldPaths=${encodeURIComponent(p)}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/orders/${encodeURIComponent(orderId)}?${maskParams}`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });
    return res.ok;
  } catch (e) {
    console.warn('[Firestore updateOrderStatus note]:', e.message);
    return false;
  }
}

module.exports = {
  isFirebaseConfigured,
  getAccessToken,
  saveProductToFirestore,
  fetchFirestoreProducts,
  deleteFirestoreProduct,
  updateFirestoreProductStock,
  syncOrderToFirestore,
  updateFirestoreOrderStatus
};
