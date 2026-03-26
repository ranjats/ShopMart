const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { connectToWhatsApp } = require('../whatsapp/bot');

router.post('/register', async (req, res) => {
    try {
        const { name, address, mobile, shopName, password } = req.body;
        
        if (!name || !address || !mobile || !shopName || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        
        await db.createShop({
            name,
            address,
            mobile,
            shopName,
            password: hashedPassword
        });

        // Initialize WhatsApp bot for this shop
        connectToWhatsApp(mobile, shopName);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { mobile, password } = req.body;
        
        if (!mobile || !password) {
            return res.status(400).json({ error: 'Mobile and password are required' });
        }

        const shop = await db.getShopByMobile(mobile);
        if (!shop) {
            return res.status(401).json({ error: 'Invalid mobile or password' });
        }

        const isMatch = bcrypt.compareSync(password, shop.password);
        if (isMatch) {
            req.session.authenticated = true;
            req.session.shopId = shop.mobile;
            req.session.shopName = shop.shopName;
            res.json({ success: true, shopName: shop.shopName });
        } else {
            res.status(401).json({ error: 'Invalid mobile or password' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

router.get('/check', (req, res) => {
    res.json({ 
        authenticated: !!req.session.authenticated,
        shopName: req.session.shopName
    });
});

module.exports = router;
