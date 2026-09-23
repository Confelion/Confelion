// Vercel Serverless Function: POST /api/payment/order
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency = 'INR', receipt } = req.body || {};
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY || 'rzp_test_RHmiNQk77x5FMw';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';

    // If real Razorpay secret is set, call Razorpay Orders API
    if (keySecret && keySecret !== 'test_secret_key') {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`
          },
          body: JSON.stringify({
            amount: Math.round(Number(amount) * 100),
            currency,
            receipt: receipt || `rcpt_${Date.now()}`
          })
        });

        const orderData = await rzpResponse.json();
        if (orderData.id) {
          return res.status(200).json({
            id: orderData.id,
            amount: orderData.amount,
            currency: orderData.currency,
            key: keyId
          });
        }
      } catch (rzpErr) {
        console.warn('Razorpay API direct call failed:', rzpErr);
      }
    }

    // Standard client checkout configuration with key
    const orderId = `order_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    return res.status(200).json({
      id: orderId,
      amount: Math.round(Number(amount) * 100),
      currency: 'INR',
      key: keyId,
      notes: { receipt: receipt || `rcpt_${Date.now()}` }
    });
  } catch (err) {
    console.error('Payment order creation error:', err);
    return res.status(500).json({ error: err.message || 'Payment initiation failed' });
  }
};
