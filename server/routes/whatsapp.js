const express = require('express');
const router = express.Router();
const { getConnectionStatus, connectToWhatsApp } = require('../whatsapp/bot');
const QRCode = require('qrcode');

router.get('/status', async (req, res) => {
    // Check auth
    if (!req.session.authenticated || !req.session.shopId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, qr } = getConnectionStatus(req.session.shopId);
    
    let qrImageUrl = null;
    if (qr) {
        try {
            qrImageUrl = await QRCode.toDataURL(qr);
        } catch (err) {
            console.error('QR Generation Error', err);
        }
    }

    res.json({ status, qr: qrImageUrl });
});

router.post('/restart', async (req, res) => {
    if (!req.session.authenticated || !req.session.shopId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const { useFirestoreAuthState } = require('../whatsapp/firestoreAuthState');
        const { removeSession } = await useFirestoreAuthState(req.session.shopId);
        await removeSession();
        await connectToWhatsApp(req.session.shopId, req.session.shopName);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
