const express = require('express');
const { auth, admin } = require('../middleware/auth');
const delhivery = require('../services/delhiveryService');
const firebaseService = require('../services/firebaseService');

module.exports = (db) => {
  const router = express.Router();

  /**
   * Public: Integration & Connection Status
   */
  router.get('/status', async (req, res) => {
    try {
      const overview = await delhivery.getAccountOverview();
      res.json(overview);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Public: Pincode Serviceability & Delivery Estimate
   */
  router.get('/serviceability/:pincode', (req, res) => {
    try {
      const result = delhivery.checkPincodeServiceability(req.params.pincode);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Public: Calculate Shipping Rates
   */
  router.post('/rates', (req, res) => {
    try {
      const { destination_pin, weight_kg, payment_mode, subtotal } = req.body;
      if (!destination_pin) {
        return res.status(400).json({ error: 'destination_pin is required' });
      }
      const rates = delhivery.calculateShippingRates({
        destinationPin: destination_pin,
        weightKg: weight_kg,
        paymentMode: payment_mode,
        subtotal
      });
      res.json(rates);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Public/Customer: Real-time AWB Shipment Tracking
   */
  router.get('/track/:awb', async (req, res) => {
    try {
      const { awb } = req.params;
      const tracking = await delhivery.trackShipment(awb);
      res.json(tracking);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Customer/Admin: Track by Confelion Order ID
   */
  router.get('/track/order/:orderId', async (req, res) => {
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const awb = order.payment_id;
      if (!awb || !String(awb).trim()) {
        return res.json({
          success: true,
          order_id: order.id,
          order_status: order.status || 'Processing',
          awb_number: null,
          carrier: 'Delhivery Express',
          delivery_status: 'Order Confirmed & Preparing for Dispatch',
          origin: 'Poonchh Hub, UP (284304)',
          message: 'Order confirmed and undergoing quality inspection at Poonchh Hub 284304. Waybill assigned upon courier dispatch.',
          timeline: []
        });
      }

      const tracking = await delhivery.trackShipment(awb);
      res.json({
        order_id: order.id,
        order_status: order.status,
        ...tracking
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Admin: Get Live Wallet Details
   */
  router.get('/wallet', auth, admin, async (req, res) => {
    try {
      const wallet = await delhivery.getWalletDetails();
      res.json(wallet);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Admin: Get Registered Warehouses / Pickup Locations
   */
  router.get('/warehouses', auth, admin, async (req, res) => {
    try {
      const warehouses = await delhivery.listPickupLocations();
      res.json(warehouses);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Admin: Get Delhivery OMS Sale Orders
   */
  router.get('/orders', auth, admin, async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 10;
      const orders = await delhivery.listDelhiveryOrders({ page, pageSize });
      res.json(orders);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * Admin: Generate Delhivery Waybill / Dispatch Shipment
   */
  router.post('/shipment/create', auth, admin, async (req, res) => {
    try {
      const { order_id, warehouse } = req.body;
      if (!order_id) {
        return res.status(400).json({ error: 'order_id is required' });
      }

      const order = db.prepare('SELECT * FROM orders WHERE id=?').get(order_id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const awb = delhivery.generateDelhiveryAwb(order_id);
      const chosenWarehouse = warehouse || delhivery.DELHIVERY_DEFAULT_WAREHOUSE;

      // Update order status in SQLite DB
      db.prepare(`
        UPDATE orders 
        SET status = 'shipped', payment_id = ?
        WHERE id = ?
      `).run(awb, order_id);

      // Sync shipment status and AWB to Cloud Firestore
      firebaseService.updateFirestoreOrderStatus(order_id, 'shipped', awb).catch(err => {
        console.warn('[Firestore Shipment Sync Note]:', err.message);
      });

      res.json({
        success: true,
        order_id,
        awb_number: awb,
        status: 'shipped',
        warehouse: chosenWarehouse,
        carrier: 'Delhivery Express',
        tracking_url: 'https://www.delhivery.com/',
        dispatched_at: new Date().toISOString()
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
