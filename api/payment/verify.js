// Vercel Serverless Function: POST /api/payment/verify
const crypto = require('crypto');

module.exports = async (req, res) => {
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_payment_id) {
      return res.status(400).json({ success: false, error: 'Payment ID is required' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';

    if (keySecret && razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, error: 'Invalid payment signature' });
      }
    }

    return res.status(200).json({
      success: true,
      verified: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Payment verification failed' });
  }
};
