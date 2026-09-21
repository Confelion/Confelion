/**
 * Confelion Customer Address Management Utility
 * Handles persistent storage, retrieval, and autofilling of delivery address details.
 */

const STORAGE_KEY_PREFIX = 'confelion_saved_shipping_';
const GENERIC_KEY = 'confelion_saved_shipping';

/**
 * Retrieves the saved shipping address for the logged-in customer.
 * Checks user profile first, then user-specific cache, then generic cache if matching email.
 *
 * @param {Object|null} user - The currently authenticated user from AuthContext
 * @returns {Object} Normalized address fields { name, email, phone, address, city, pincode }
 */
export function getSavedShippingAddress(user) {
  const defaultValues = {
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    pincode: user?.pincode || ''
  };

  if (!user) {
    return defaultValues;
  }

  // 1. Try user ID cache
  if (user.id) {
    try {
      const cached = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          name: parsed.name || defaultValues.name,
          email: user.email || parsed.email || defaultValues.email,
          phone: parsed.phone || defaultValues.phone,
          address: parsed.address || defaultValues.address,
          city: parsed.city || defaultValues.city,
          pincode: parsed.pincode || defaultValues.pincode
        };
      }
    } catch {}
  }

  // 2. Try user email cache
  if (user.email) {
    try {
      const cachedEmail = localStorage.getItem(`${STORAGE_KEY_PREFIX}${user.email.toLowerCase()}`);
      if (cachedEmail) {
        const parsed = JSON.parse(cachedEmail);
        return {
          name: parsed.name || defaultValues.name,
          email: user.email,
          phone: parsed.phone || defaultValues.phone,
          address: parsed.address || defaultValues.address,
          city: parsed.city || defaultValues.city,
          pincode: parsed.pincode || defaultValues.pincode
        };
      }
    } catch {}
  }

  // 3. Try generic cache if email matches
  try {
    const generic = localStorage.getItem(GENERIC_KEY);
    if (generic) {
      const parsed = JSON.parse(generic);
      if (!parsed.email || parsed.email.toLowerCase() === user.email?.toLowerCase()) {
        return {
          name: parsed.name || defaultValues.name,
          email: user.email || parsed.email || defaultValues.email,
          phone: parsed.phone || defaultValues.phone,
          address: parsed.address || defaultValues.address,
          city: parsed.city || defaultValues.city,
          pincode: parsed.pincode || defaultValues.pincode
        };
      }
    }
  } catch {}

  return defaultValues;
}

/**
 * Saves shipping address upon checkout or profile update so it autofills automatically next time.
 *
 * @param {Object|null} user - The currently authenticated user
 * @param {Object} shippingData - Form fields { name, email, phone, address, city, pincode }
 * @param {Function} [updateUserFn] - Optional updateUser function from useAuth()
 */
export async function saveCustomerShippingAddress(user, shippingData, updateUserFn = null) {
  if (!shippingData) return;

  const normalized = {
    name: (shippingData.name || user?.name || '').trim(),
    email: (shippingData.email || user?.email || '').trim().toLowerCase(),
    phone: (shippingData.phone || '').trim(),
    address: (shippingData.address || '').trim(),
    city: (shippingData.city || '').trim(),
    pincode: (shippingData.pincode || '').trim(),
    saved_at: new Date().toISOString()
  };

  // 1. Cache under user ID and email
  try {
    if (user?.id) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, JSON.stringify(normalized));
    }
    if (user?.email) {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.email.toLowerCase()}`, JSON.stringify(normalized));
    }
    localStorage.setItem(GENERIC_KEY, JSON.stringify(normalized));
  } catch {}

  // 2. Update user profile state in AuthContext & Cloud Firestore
  if (typeof updateUserFn === 'function') {
    try {
      await updateUserFn({
        name: normalized.name || user?.name,
        phone: normalized.phone,
        address: normalized.address,
        city: normalized.city,
        pincode: normalized.pincode
      });
    } catch (err) {
      console.warn('Could not sync address to user profile:', err);
    }
  }

  // 3. Dispatch address update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shipping-address-updated', { detail: normalized }));
  }

  return normalized;
}
