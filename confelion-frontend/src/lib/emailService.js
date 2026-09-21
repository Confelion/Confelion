/**
 * Frontend Email Service (Resend integration)
 * Dispatches transactional notifications for order confirmation and user registration.
 */

const API_BASE = '';

/**
 * Trigger an order confirmation email via backend Resend service.
 * @param {Object} order - Full order object with customer details, items, and total
 */
export async function sendOrderConfirmationEmail(order) {
  if (!order || !order.email) {
    console.warn('[EmailService] Order missing recipient email address.');
    return { success: false, error: 'No recipient email' };
  }

  try {
    const response = await fetch(`${API_BASE}/api/email/order-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn('[EmailService] Order email notice:', err.error || response.statusText);
      return { success: false, error: err.error };
    }

    const data = await response.json();
    console.log('[EmailService] Order confirmation email dispatched:', data);
    return data;
  } catch (err) {
    console.warn('[EmailService] Email dispatch note (offline or simulated):', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger welcome email for new member registration.
 * @param {Object} params
 * @param {string} params.email - Patron email address
 * @param {string} params.name - Patron display name
 */
export async function sendWelcomeEmail({ email, name }) {
  if (!email) return { success: false };

  try {
    const response = await fetch(`${API_BASE}/api/email/welcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name })
    });

    return await response.json();
  } catch (err) {
    console.warn('[EmailService] Welcome email note:', err.message);
    return { success: false };
  }
}
