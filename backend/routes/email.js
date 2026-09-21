const express = require('express');
const { 
  isResendConfigured, 
  sendOrderConfirmationEmail, 
  sendWelcomeEmail, 
  sendAdminOrderAlert 
} = require('../services/emailService');

module.exports = (db) => {
  const router = express.Router();

  // Status check for Resend configuration
  router.get('/status', (req, res) => {
    res.json({
      configured: isResendConfigured(),
      provider: isResendConfigured() ? 'resend' : 'simulated-console',
      timestamp: new Date().toISOString()
    });
  });

  // Send order confirmation to customer & store admin
  router.post('/order-confirmation', async (req, res) => {
    try {
      const order = req.body;
      if (!order || !order.id) {
        return res.status(400).json({ error: 'Valid order object required' });
      }

      // 1. Send confirmation to patron
      const customerResult = await sendOrderConfirmationEmail(order);

      // 2. Alert store admin
      sendAdminOrderAlert(order).catch(err => console.warn('Admin order alert error:', err.message));

      res.json({
        success: true,
        orderId: order.id,
        recipient: order.email,
        result: customerResult
      });
    } catch (err) {
      console.error('Email route error:', err);
      res.status(500).json({ error: err.message || 'Failed to dispatch email' });
    }
  });

  // Send welcome email to new member
  router.post('/welcome', async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const result = await sendWelcomeEmail({ email, name });
      res.json({ success: true, result });
    } catch (err) {
      console.error('Welcome email error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
