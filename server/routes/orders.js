const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { sendStatusUpdate } = require('../whatsapp/bot');

// Middleware to check authentication
const checkAuth = (req, res, next) => {
    if (!req.session.authenticated || !req.session.shopId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// GET all orders
router.get('/', checkAuth, async (req, res) => {
    try {
        const { status, date } = req.query;
        const orders = await db.getAllOrders(req.session.shopId, { status, date });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single order
router.get('/:id', checkAuth, async (req, res) => {
    try {
        const order = await db.getOrderById(req.params.id, req.session.shopId);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE order status
router.put('/:id/status', checkAuth, async (req, res) => {
    try {
        const { status, bill_amount } = req.body;
        const validStatuses = ['pending', 'preparing', 'ready', 'completed'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await db.updateOrderStatus(req.params.id, status, req.session.shopId, bill_amount);
        
        // Send WhatsApp notification
        if (order) {
            await sendStatusUpdate(order.customer_phone, status, order.order_id, order.bill_amount, req.session.shopId);
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
