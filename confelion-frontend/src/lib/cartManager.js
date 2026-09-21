import { saveCustomerCartToFirestore, fetchCustomerCartFromFirestore } from './firebase.js';

const CART_STORAGE_KEY = 'cart';
const CART_META_KEY = 'confelion_cart_cache';
const CART_TRACKING_KEY = 'confelion_cart_tracking';

/**
 * Get current cached cart items safely from localStorage.
 * @returns {Array} Array of cart item objects
 */
export function getCachedCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Record an Add-To-Cart or Cart Mutation event in cache history.
 * Tracks user activity, timestamps, product selections, and sessions.
 * @param {string} eventType - e.g. 'add_to_cart' | 'update_qty' | 'remove_item' | 'cart_linked_to_customer'
 * @param {Object} payload - Details of the event
 */
export function logCartEvent(eventType, payload = {}) {
  try {
    const existing = JSON.parse(localStorage.getItem(CART_TRACKING_KEY) || '[]');
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {}

    const eventRecord = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      event: eventType,
      userId: user?.id || null,
      userEmail: user?.email || null,
      payload,
      timestamp: new Date().toISOString()
    };

    // Store up to 100 historical cart activity events in client cache
    const updated = [eventRecord, ...existing].slice(0, 100);
    localStorage.setItem(CART_TRACKING_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[CartTracker] Could not record event in cache:', err.message);
  }
}

/**
 * Retrieve the Add-To-Cart tracking history from cache.
 * @returns {Array}
 */
export function getCartTrackingHistory() {
  try {
    return JSON.parse(localStorage.getItem(CART_TRACKING_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Save items to local cache and synchronize with customer Firestore account if authenticated.
 * @param {Array} items - List of cart items
 * @param {boolean} syncToFirestore - Whether to push update to Firestore
 */
export function saveCartToCache(items, syncToFirestore = true) {
  try {
    const safeItems = Array.isArray(items) ? items : [];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(safeItems));
    
    // Cache metadata snapshot
    localStorage.setItem(CART_META_KEY, JSON.stringify({
      itemCount: safeItems.reduce((sum, item) => sum + (item.qty || 1), 0),
      totalValue: safeItems.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0),
      lastUpdated: new Date().toISOString()
    }));

    // Broadcast cart change event across components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-updated', { detail: safeItems }));
    }

    // Sync to customer cloud account if logged in
    if (syncToFirestore) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user && user.id) {
          saveCustomerCartToFirestore(user.id, safeItems).catch(() => {});
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[CartManager] Error writing to cart cache:', err.message);
  }
}

/**
 * Add an item to cart:
 * 1. Updates cached items in localStorage
 * 2. Caches Add-To-Cart event with timestamp and product details
 * 3. Syncs to customer account if logged in
 * 4. Dispatches global events for badge and drawer
 * 
 * @param {Object} product - Product data object
 * @param {string} selectedSize - Size option selected (default: 'M')
 * @param {number} qty - Quantity to add (default: 1)
 * @returns {Array} Updated cart items
 */
export function addItemToCart(product, selectedSize = 'M', qty = 1) {
  if (!product) return getCachedCart();

  const cart = getCachedCart();
  const existingIdx = cart.findIndex(
    (item) => (item.handle === product.handle || item.id === product.id) && item.size === selectedSize
  );

  const primaryImage = product.image || product.image_url || (Array.isArray(product.images) ? product.images[0] : '');

  if (existingIdx > -1) {
    cart[existingIdx].qty = (cart[existingIdx].qty || 1) + qty;
  } else {
    cart.push({
      id: product.id,
      handle: product.handle,
      title: product.title,
      price: product.price,
      compare_at_price: product.compare_at_price || null,
      image: primaryImage,
      size: selectedSize,
      qty: qty
    });
  }

  // 1. Cache updated cart and sync to account
  saveCartToCache(cart, true);

  // 2. Track Add-To-Cart in cache event log
  logCartEvent('add_to_cart', {
    productId: product.id,
    handle: product.handle,
    title: product.title,
    size: selectedSize,
    qty,
    price: product.price,
    image: primaryImage
  });

  return cart;
}

/**
 * Update quantity for an item at index.
 * @param {number} index - Index of item in cart
 * @param {number} deltaOrQty - Value to change by or set to
 * @param {boolean} isDelta - True if delta (+1/-1), false if absolute value
 */
export function updateItemQuantity(index, deltaOrQty, isDelta = true) {
  const cart = getCachedCart();
  if (!cart[index]) return cart;

  const currentQty = cart[index].qty || 1;
  const newQty = isDelta ? currentQty + deltaOrQty : deltaOrQty;

  if (newQty <= 0) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    logCartEvent('remove_item', { item: removedItem });
  } else {
    cart[index].qty = newQty;
    logCartEvent('update_qty', { item: cart[index], newQty });
  }

  saveCartToCache(cart, true);
  return cart;
}

/**
 * Remove an item from the cart.
 * @param {number} index - Index of item to remove
 */
export function removeItemFromCart(index) {
  const cart = getCachedCart();
  if (cart[index]) {
    const removedItem = cart[index];
    cart.splice(index, 1);
    logCartEvent('remove_item', { item: removedItem });
    saveCartToCache(cart, true);
  }
  return cart;
}

/**
 * Clear all items from the cart (e.g. on order completion).
 */
export function clearCart() {
  saveCartToCache([], true);
  logCartEvent('clear_cart');
}

/**
 * Link guest cached cart with customer account on login/registration.
 * Merges cached local items with any existing items saved in the customer's cloud account.
 * 
 * @param {string} userId - Authenticated customer's unique ID
 */
export async function linkCartToCustomer(userId) {
  if (!userId) return getCachedCart();

  try {
    const localItems = getCachedCart();
    const remoteItems = await fetchCustomerCartFromFirestore(userId);

    // If neither local nor remote has items, nothing to merge
    if ((!localItems || localItems.length === 0) && (!remoteItems || remoteItems.length === 0)) {
      return [];
    }

    // Merge strategy: Start with remote items, merge in local items
    const merged = [...(remoteItems || [])];

    if (Array.isArray(localItems)) {
      for (const localItem of localItems) {
        const existingIdx = merged.findIndex(
          (r) => (r.handle === localItem.handle || r.id === localItem.id) && r.size === localItem.size
        );

        if (existingIdx > -1) {
          // Add local quantity to existing remote quantity
          merged[existingIdx].qty = (merged[existingIdx].qty || 1) + (localItem.qty || 1);
        } else {
          // Add new item into customer cart
          merged.push(localItem);
        }
      }
    }

    // 1. Update local cache with merged cart
    saveCartToCache(merged, false);

    // 2. Persist merged cart into customer account in Cloud Firestore
    await saveCustomerCartToFirestore(userId, merged);

    // 3. Log linking event
    logCartEvent('cart_linked_to_customer', {
      userId,
      itemCount: merged.reduce((s, i) => s + (i.qty || 1), 0),
      items: merged
    });

    return merged;
  } catch (err) {
    console.warn('[CartManager] Error linking cart to customer account:', err.message);
    return getCachedCart();
  }
}
