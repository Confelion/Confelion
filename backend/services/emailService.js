require('dotenv').config();

// Resend Email Configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Confelion <orders@confelion.com>';
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'confelion@gmail.com';

function isResendConfigured() {
  return Boolean(RESEND_API_KEY && RESEND_API_KEY.startsWith('re_'));
}

/**
 * Send an email using Resend REST API
 */
async function sendEmail({ to, subject, html, replyTo = null }) {
  if (!isResendConfigured()) {
    console.log('\n[SIMULATED EMAIL - Resend API key pending in .env]');
    console.log(`To: ${to}`);
    console.log(`From: ${RESEND_FROM_EMAIL}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------------------------------\n');
    return {
      success: true,
      simulated: true,
      message: 'Email simulated in console. Add RESEND_API_KEY in .env to send live emails.'
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: replyTo || undefined
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Resend error: ${response.statusText}`);
  }

  return { success: true, id: data.id };
}

/**
 * Build an elegant, luxury Confelion HTML template for order confirmation.
 */
function buildOrderConfirmationHtml(order) {
  const items = order.items || [];
  const itemsRows = items.map((item) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #222; color: #ffffff; font-size: 14px;">
        <strong style="text-transform: uppercase; letter-spacing: 0.05em;">${item.title || 'Confelion Garment'}</strong>
        <div style="font-size: 12px; color: #888888; margin-top: 4px;">Size: ${item.size || 'Standard'} | Qty: ${item.qty || 1}</div>
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #222; text-align: right; color: #ffffff; font-family: monospace; font-size: 14px;">
        ₹${((item.price || 0) * (item.qty || 1)).toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - Confelion</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #000000; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #09090b; border: 1px solid #27272a; padding: 40px; border-radius: 4px;">
              <!-- Header -->
              <tr>
                <td align="center" style="padding-bottom: 30px; border-bottom: 1px solid #27272a;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.35em; text-transform: uppercase; color: #ffffff;">CONFELION</h1>
                  <p style="margin: 6px 0 0; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #a1a1aa;">ARCHIVAL LUXURY & ATELIER</p>
                </td>
              </tr>

              <!-- Greeting -->
              <tr>
                <td style="padding: 30px 0 20px;">
                  <h2 style="margin: 0; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #ffffff;">Order Confirmed</h2>
                  <p style="margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
                    Thank you for your patronage, <strong style="color: #ffffff;">${order.customer_name || 'Valued Patron'}</strong>. Your piece is being prepared by our atelier team.
                  </p>
                  <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; font-family: monospace;">
                    Order Reference: <span style="color: #ffffff; font-weight: bold;">${order.id}</span>
                  </p>
                </td>
              </tr>

              <!-- Itemized Table -->
              <tr>
                <td style="padding-bottom: 24px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <thead>
                      <tr>
                        <th align="left" style="padding-bottom: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; border-bottom: 1px solid #3f3f46;">Selection</th>
                        <th align="right" style="padding-bottom: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a; border-bottom: 1px solid #3f3f46;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsRows}
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- Totals -->
              <tr>
                <td style="padding: 16px 0; border-top: 1px solid #27272a; border-bottom: 1px solid #27272a;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="4">
                    <tr>
                      <td style="font-size: 13px; color: #a1a1aa;">Subtotal</td>
                      <td align="right" style="font-size: 13px; color: #ffffff; font-family: monospace;">₹${(order.subtotal || order.total || 0).toLocaleString('en-IN')}</td>
                    </tr>
                    ${order.cod_fee ? `
                    <tr>
                      <td style="font-size: 13px; color: #a1a1aa;">COD Handling</td>
                      <td align="right" style="font-size: 13px; color: #ffffff; font-family: monospace;">₹${order.cod_fee}</td>
                    </tr>` : ''}
                    <tr>
                      <td style="font-size: 15px; font-weight: 700; color: #ffffff; padding-top: 8px;">Grand Total</td>
                      <td align="right" style="font-size: 16px; font-weight: 700; color: #ffffff; font-family: monospace; padding-top: 8px;">₹${(order.total || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Shipping Info -->
              <tr>
                <td style="padding: 24px 0;">
                  <h3 style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #71717a;">Delivery Address</h3>
                  <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e4e4e7;">
                    ${order.customer_name || ''}<br/>
                    ${order.shipping_address || ''}<br/>
                    ${order.city || ''} ${order.pincode || ''}<br/>
                    Phone: ${order.phone || 'N/A'}
                  </p>
                </td>
              </tr>

              <!-- Footer Contact -->
              <tr>
                <td align="center" style="padding-top: 30px; border-top: 1px solid #27272a; color: #71717a; font-size: 11px; line-height: 1.6;">
                  <p style="margin: 0;">Questions about your piece? Contact our Concierge at <a href="mailto:concierge@confelion.com" style="color: #ffffff; text-decoration: underline;">concierge@confelion.com</a></p>
                  <p style="margin: 6px 0 0;">© ${new Date().getFullYear()} CONFELION. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Send customer order confirmation email.
 */
async function sendOrderConfirmationEmail(order) {
  const recipient = order.email;
  if (!recipient) {
    console.warn('Cannot send order confirmation: No recipient email provided.');
    return { success: false, error: 'No email provided' };
  }

  const subject = `Confirmed: Your Confelion Order [${order.id}]`;
  const html = buildOrderConfirmationHtml(order);

  return await sendEmail({
    to: recipient,
    subject,
    html
  });
}

/**
 * Send welcome email to newly registered patrons.
 */
async function sendWelcomeEmail({ email, name }) {
  if (!email) return { success: false, error: 'No email provided' };

  const subject = `Welcome to the Atelier - Confelion`;
  const html = `
    <div style="background-color: #000; color: #fff; padding: 40px; font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #222;">
      <h1 style="letter-spacing: 0.3em; text-transform: uppercase; font-size: 22px;">CONFELION</h1>
      <p style="color: #888; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase;">MEMBER PRIVILEGES ACTIVATED</p>
      <hr style="border: 0; border-top: 1px solid #222; margin: 20px 0;"/>
      <p>Greetings ${name || 'Patron'},</p>
      <p style="line-height: 1.6; color: #ccc;">Welcome to the inner circle of Confelion. Your account grants you priority access to seasonal drops, lookbook releases, and private atelier showings.</p>
      <p style="margin-top: 30px;"><a href="https://confelion.com" style="background: #fff; color: #000; padding: 12px 24px; text-decoration: none; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em;">Visit Storefront</a></p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject,
    html
  });
}

/**
 * Notify store admin of new order.
 */
async function sendAdminOrderAlert(order) {
  const subject = `[New Order Alert] ${order.id} - ₹${(order.total || 0).toLocaleString('en-IN')}`;
  const html = `
    <div style="font-family: sans-serif; color: #111; padding: 20px;">
      <h2>New Confelion Order Placed</h2>
      <p><strong>Order ID:</strong> ${order.id}</p>
      <p><strong>Customer:</strong> ${order.customer_name} (${order.email})</p>
      <p><strong>Total:</strong> ₹${order.total}</p>
      <p><strong>Payment Method:</strong> ${order.payment_method}</p>
      <p><strong>Items:</strong> ${(order.items || []).map(i => `${i.title} (x${i.qty || 1})`).join(', ')}</p>
    </div>
  `;

  return await sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject,
    html
  });
}

module.exports = {
  isResendConfigured,
  sendEmail,
  sendOrderConfirmationEmail,
  sendWelcomeEmail,
  sendAdminOrderAlert,
};
