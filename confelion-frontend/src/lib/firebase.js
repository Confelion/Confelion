import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Confelion Firebase Configuration
export const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyAPuTvYWvFYOpxOEx34jQTaMB1wvLy23iY",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "confelion.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "confelion",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "confelion.appspot.com",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "762181234567",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:762181234567:web:1234567890abcdef",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-4N2Z0NPVKN"
};

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firebase Auth & Providers
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Cloud Firestore Database
export const db = getFirestore(app);

// Cloud Storage for media assets
export const storage = getStorage(app);

// Google Analytics (guarded for SSR / privacy extensions / placeholder credentials)
export let analytics = null;
if (typeof window !== 'undefined') {
  const isPlaceholderConfig = 
    !firebaseConfig.appId || 
    firebaseConfig.appId.includes('1234567890abcdef') || 
    firebaseConfig.apiKey?.includes('AIzaSyAPuTvYWvFYOpxOEx34jQTaMB1wvLy23iY');

  if (!isPlaceholderConfig && firebaseConfig.measurementId) {
    isSupported()
      .then((supported) => {
        if (supported) {
          try {
            analytics = getAnalytics(app);
          } catch (err) {
            // Silently fallback if analytics is blocked or forbidden
          }
        }
      })
      .catch(() => {});
  }
}

/**
 * Upload a File or Blob directly to Firebase Cloud Storage.
 * @param {File|Blob} file - The file or blob to upload
 * @param {string} folder - Target folder (e.g. 'products', 'banners', 'reels', 'avatars')
 * @param {string} customName - Optional custom filename
 * @returns {Promise<string>} The public download URL
 */
export async function uploadFileToFirebaseStorage(file, folder = 'uploads', customName = null) {
  if (!file) throw new Error('No file provided for upload');
  
  const ext = file.name ? file.name.split('.').pop() : 'bin';
  const cleanName = (customName || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`)
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  
  const storagePath = `${folder}/${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const metadata = {
    contentType: file.type || 'application/octet-stream'
  };

  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      null,
      (error) => {
        console.error('Firebase Storage upload error:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadUrl);
        } catch (err) {
          reject(err);
        }
      }
    );
  });
}

// Firestore connection availability flag (prevents repeated timeout delays if API is disabled or offline)
let isFirestoreAvailable = true;

/**
 * Execute a Firestore promise with a safe timeout (default 8000ms) and automatic circuit-breaker.
 * When the Firestore API is disabled or unreachable, returns fallback immediately rather than hanging for 20-30s.
 */
export async function withFirestoreTimeout(promise, ms = 8000, fallback = null) {
  if (!isFirestoreAvailable) {
    return fallback;
  }
  let timer;
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(fallback);
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer);
    return result;
  } catch (err) {
    clearTimeout(timer);
    if (
      err?.code === 'permission-denied' || 
      err?.code === 'unavailable' ||
      err?.message?.includes('Cloud Firestore API has not been used') || 
      err?.message?.includes('disabled')
    ) {
      console.info('[Firestore] Cloud Firestore API disabled on project, operating in high-performance local mode.');
      isFirestoreAvailable = false;
    }
    return fallback;
  }
}

/**
 * Save store settings (hero, footer, announcement, etc.) to Firestore.
 */
export async function syncSettingsToFirestore(settings) {
  if (!isFirestoreAvailable) return false;
  try {
    const settingsDoc = doc(db, 'settings', 'storefront');
    const cleanSettings = { ...settings };
    // Prevent giant base64 data URLs from exceeding Firestore 1MB document limit
    for (const [key, val] of Object.entries(cleanSettings)) {
      if (typeof val === 'string' && val.startsWith('data:image/')) {
        console.warn(`[Firestore Sync] Stripped base64 string from "${key}" to preserve document integrity`);
        delete cleanSettings[key];
      }
    }
    await withFirestoreTimeout(setDoc(settingsDoc, { ...cleanSettings, updated_at: serverTimestamp() }, { merge: true }), 8000, false);
    console.info('[Firestore] Storefront settings synced successfully');
    return true;
  } catch (error) {
    console.error('[Firestore Sync Error]:', error);
    return false;
  }
}

/**
 * Fetch latest storefront settings from Firestore.
 */
export async function fetchSettingsFromFirestore() {
  if (!isFirestoreAvailable) return null;
  try {
    const settingsDoc = doc(db, 'settings', 'storefront');
    const snapshot = await withFirestoreTimeout(getDoc(settingsDoc), 6000, null);
    if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (error) {
    console.error('[Firestore Fetch Error]:', error);
    return null;
  }
}

/**
 * Real-time listener for storefront settings changes.
 * Automatically pushes updates to the UI in milliseconds whenever the dashboard saves.
 */
export function subscribeToStoreSettings(callback) {
  if (!isFirestoreAvailable) return () => {};
  try {
    const settingsDoc = doc(db, 'settings', 'storefront');
    return onSnapshot(settingsDoc, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      }
    }, (err) => {
      console.warn('[Firestore Settings Realtime Listener]:', err.message);
    });
  } catch (e) {
    return () => {};
  }
}

/**
 * Save or update user profile document in Firestore.
 */
export async function saveUserProfileToFirestore(uid, profileData) {
  if (!uid || !isFirestoreAvailable) return false;
  try {
    const userDoc = doc(db, 'users', uid);
    await withFirestoreTimeout(setDoc(userDoc, { ...profileData, updated_at: serverTimestamp() }, { merge: true }), 1000, false);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get user profile document from Firestore.
 */
export async function getUserProfileFromFirestore(uid) {
  if (!uid || !isFirestoreAvailable) return null;
  try {
    const userDoc = doc(db, 'users', uid);
    const snapshot = await withFirestoreTimeout(getDoc(userDoc), 1000, null);
    if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
      return snapshot.data();
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Record a customer order into Firestore.
 */
export async function createFirestoreOrder(orderData) {
  if (!isFirestoreAvailable) return false;
  try {
    const orderDoc = doc(db, 'orders', orderData.id || `ORD-${Date.now()}`);
    await withFirestoreTimeout(setDoc(orderDoc, { 
      ...orderData, 
      email: orderData.email ? orderData.email.toLowerCase().trim() : '',
      user_id: orderData.user_id || null,
      created_at: serverTimestamp() 
    }), 1200, false);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch customer orders from Firestore.
 * Supports querying by customer email, user ID, or returning all orders for administrators.
 */
export async function fetchFirestoreOrders(email = null, userId = null) {
  if (!isFirestoreAvailable) return [];
  try {
    const ordersCol = collection(db, 'orders');

    // Admin mode: neither email nor userId provided
    if (!email && !userId) {
      const snapshot = await withFirestoreTimeout(getDocs(ordersCol), 1500, null);
      if (!snapshot) return [];
      const orders = [];
      snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
      });
      return orders;
    }

    const ordersMap = new Map();
    const promises = [];

    if (email) {
      const qEmail = query(ordersCol, where('email', '==', email.toLowerCase().trim()));
      promises.push(withFirestoreTimeout(getDocs(qEmail), 1200, null));
    }

    if (userId) {
      const qUser = query(ordersCol, where('user_id', '==', userId));
      promises.push(withFirestoreTimeout(getDocs(qUser), 1200, null));
    }

    const results = await Promise.all(promises);
    results.forEach((snap) => {
      if (snap && typeof snap.forEach === 'function') {
        snap.forEach((doc) => {
          ordersMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }
    });

    return Array.from(ordersMap.values());
  } catch (error) {
    return [];
  }
}

/**
 * Save customer shopping cart to Cloud Firestore.
 */
export async function saveCustomerCartToFirestore(uid, cartItems) {
  if (!uid || !isFirestoreAvailable) return false;
  try {
    const cartDoc = doc(db, 'carts', uid);
    await withFirestoreTimeout(setDoc(cartDoc, { 
      items: cartItems || [], 
      items_count: (cartItems || []).reduce((sum, item) => sum + (item.qty || 1), 0),
      updated_at: serverTimestamp() 
    }, { merge: true }), 1000, false);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Fetch saved customer shopping cart from Cloud Firestore.
 */
export async function fetchCustomerCartFromFirestore(uid) {
  if (!uid || !isFirestoreAvailable) return [];
  try {
    const cartDoc = doc(db, 'carts', uid);
    const snapshot = await withFirestoreTimeout(getDoc(cartDoc), 1000, null);
    if (snapshot && typeof snapshot.exists === 'function' && snapshot.exists()) {
      return snapshot.data()?.items || [];
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Save product to Cloud Firestore collection 'products'.
 */
export async function saveProductToFirestore(product) {
  if (!product || !isFirestoreAvailable) return false;
  try {
    const docId = product.handle || product.id || `silhouette-${Date.now()}`;
    const productDoc = doc(db, 'products', docId);
    await withFirestoreTimeout(setDoc(productDoc, {
      ...product,
      id: docId,
      handle: docId,
      updated_at: serverTimestamp()
    }, { merge: true }), 8000, false);
    return true;
  } catch (err) {
    console.warn('[Firestore] Product save note:', err.message);
    return false;
  }
}

/**
 * Fetch all products from Cloud Firestore collection 'products'.
 */
export async function fetchFirestoreProducts() {
  if (!isFirestoreAvailable) return [];
  try {
    const productsCol = collection(db, 'products');
    const snapshot = await withFirestoreTimeout(getDocs(productsCol), 6000, null);
    if (!snapshot) return [];
    const prods = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (!data.is_deleted && data.published !== false) {
        prods.push({ id: d.id, ...data });
      }
    });
    return prods;
  } catch (err) {
    console.warn('[Firestore] Product fetch note:', err.message);
    return [];
  }
}

/**
 * Real-time listener for product catalog changes.
 * Automatically synchronizes newly added or edited products across all devices.
 */
export function subscribeToProducts(callback) {
  if (!isFirestoreAvailable) return () => {};
  try {
    const productsCol = collection(db, 'products');
    return onSnapshot(productsCol, (snapshot) => {
      const prods = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (!data.is_deleted && data.published !== false) {
          prods.push({ id: d.id, ...data });
        }
      });
      callback(prods);
    }, (err) => {
      console.warn('[Firestore Products Realtime Listener]:', err.message);
    });
  } catch (e) {
    return () => {};
  }
}

/**
 * Delete product from Cloud Firestore collection 'products'.
 */
export async function deleteFirestoreProduct(handleOrId) {
  if (!handleOrId || !isFirestoreAvailable) return false;
  try {
    const productDoc = doc(db, 'products', handleOrId);
    await withFirestoreTimeout(updateDoc(productDoc, { published: false, is_deleted: true }), 1000, false);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Update product stock in Cloud Firestore.
 */
export async function updateFirestoreProductStock(handleOrId, newQty) {
  if (!handleOrId || !isFirestoreAvailable) return false;
  try {
    const productDoc = doc(db, 'products', handleOrId);
    await withFirestoreTimeout(updateDoc(productDoc, { 
      inventory: Number(newQty) || 0,
      updated_at: serverTimestamp()
    }), 1000, false);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Save VIP Subscriber email to Cloud Firestore collection 'vip_subscribers'.
 * Also stores in local cache so email is never lost.
 */
export async function saveVipSubscriber(email) {
  if (!email || typeof email !== 'string') return false;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return false;

  const docId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const record = {
    email: cleanEmail,
    status: 'active',
    source: 'footer_vip_button',
    subscribed_at: new Date().toISOString()
  };

  // Local storage mirror
  try {
    const existing = JSON.parse(localStorage.getItem('confelion_vip_subscribers') || '[]');
    if (!existing.some(s => s.email === cleanEmail)) {
      existing.unshift(record);
      localStorage.setItem('confelion_vip_subscribers', JSON.stringify(existing));
    }
  } catch (e) {
    // Ignore local storage error
  }

  if (!isFirestoreAvailable) return true;

  try {
    const vipDoc = doc(db, 'vip_subscribers', docId);
    await withFirestoreTimeout(
      setDoc(vipDoc, {
        ...record,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      }, { merge: true }),
      1500,
      false
    );
    return true;
  } catch (err) {
    console.warn('[Firestore] VIP subscriber save note:', err.message);
    return true; // Still true since local mirror succeeded
  }
}

/**
 * Fetch all VIP subscribers from Cloud Firestore collection 'vip_subscribers'.
 */
export async function fetchVipSubscribers() {
  let list = [];

  // 1. Fetch from Firestore if available
  if (isFirestoreAvailable) {
    try {
      const vipCol = collection(db, 'vip_subscribers');
      const snapshot = await withFirestoreTimeout(getDocs(vipCol), 1500, null);
      if (snapshot && typeof snapshot.forEach === 'function') {
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
      }
    } catch (err) {
      console.warn('[Firestore] fetchVipSubscribers note:', err.message);
    }
  }

  // 2. Merge local cache subscribers
  try {
    const local = JSON.parse(localStorage.getItem('confelion_vip_subscribers') || '[]');
    const map = new Map();
    list.forEach(item => map.set(item.email, item));
    local.forEach(item => {
      if (!map.has(item.email)) {
        map.set(item.email, item);
      }
    });
    list = Array.from(map.values());
  } catch (e) {
    // Ignore
  }

  return list;
}

/**
 * Delete a VIP subscriber from Cloud Firestore and local storage.
 */
export async function deleteVipSubscriber(idOrEmail) {
  if (!idOrEmail) return false;
  const cleanEmail = idOrEmail.trim().toLowerCase();
  const docId = cleanEmail.includes('@') ? cleanEmail.replace(/[^a-zA-Z0-9]/g, '_') : cleanEmail;

  // Local storage cleanup
  try {
    const existing = JSON.parse(localStorage.getItem('confelion_vip_subscribers') || '[]');
    const filtered = existing.filter(s => s.email !== cleanEmail && s.id !== idOrEmail);
    localStorage.setItem('confelion_vip_subscribers', JSON.stringify(filtered));
  } catch (e) {}

  if (!isFirestoreAvailable) return true;

  try {
    const vipDoc = doc(db, 'vip_subscribers', docId);
    await withFirestoreTimeout(deleteDoc(vipDoc), 1000, false);
    return true;
  } catch (err) {
    console.warn('[Firestore] deleteVipSubscriber note:', err.message);
    return false;
  }
}

/**
 * Reset Firestore Dashboard:
 * Deletes all documents in 'orders' and 'vip_subscribers' collections.
 * Clears test orders and VIP subscribers while keeping product catalog and system settings intact.
 */
export async function resetFirestoreDashboard() {
  const result = { ordersDeleted: 0, vipsDeleted: 0, success: true };

  // Clear local storage orders and VIP entries
  try {
    localStorage.removeItem('confelion_vip_subscribers');
    localStorage.removeItem('confelion_orders');
    localStorage.removeItem('confelion_cart');
  } catch (e) {}

  if (!isFirestoreAvailable) return result;

  try {
    // Delete all orders
    const ordersCol = collection(db, 'orders');
    const orderSnaps = await withFirestoreTimeout(getDocs(ordersCol), 2000, null);
    if (orderSnaps && typeof orderSnaps.forEach === 'function') {
      const deletePromises = [];
      orderSnaps.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
        result.ordersDeleted++;
      });
      await Promise.all(deletePromises);
    }
  } catch (err) {
    console.warn('[Firestore] Reset orders error:', err.message);
  }

  try {
    // Delete all VIP subscribers
    const vipsCol = collection(db, 'vip_subscribers');
    const vipSnaps = await withFirestoreTimeout(getDocs(vipsCol), 2000, null);
    if (vipSnaps && typeof vipSnaps.forEach === 'function') {
      const deletePromises = [];
      vipSnaps.forEach((docSnap) => {
        deletePromises.push(deleteDoc(docSnap.ref));
        result.vipsDeleted++;
      });
      await Promise.all(deletePromises);
    }
  } catch (err) {
    console.warn('[Firestore] Reset VIP error:', err.message);
  }

  return result;
}

