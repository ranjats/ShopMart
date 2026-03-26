const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Middleware to check authentication
const checkAuth = (req, res, next) => {
    if (!req.session.authenticated || !req.session.shopId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// GET all products
router.get('/', checkAuth, async (req, res) => {
    try {
        const products = await db.getAllProducts(req.session.shopId);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD product
router.post('/', checkAuth, async (req, res) => {
    try {
        const { name, price, quantity } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        
        await db.addProduct(name, price || 0, quantity || 0, req.session.shopId);
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE product
router.put('/:id', checkAuth, async (req, res) => {
    try {
        const { price, quantity } = req.body;
        await db.updateProduct(req.params.id, price, quantity, req.session.shopId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE product
router.delete('/:id', checkAuth, async (req, res) => {
    try {
        await db.deleteProduct(req.params.id, req.session.shopId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
