const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const db = require('./config/db');
const { startAllBots } = require('./whatsapp/bot');

// Load env variables
dotenv.config();

const startServer = async () => {
    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware
    app.use(cors({
        origin: 'http://localhost:5173', // Vite dev server
        credentials: true
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
        secret: 'grocery_bot_secret_key_8823',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false } // Set to true if using HTTPS
    }));

    // Routes
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/orders', require('./routes/orders'));
    app.use('/api/products', require('./routes/products'));
    app.use('/api/whatsapp', require('./routes/whatsapp'));

    // Stats Route
    app.get('/api/stats', async (req, res) => {
        if (!req.session.authenticated || !req.session.shopId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        try {
            const stats = await db.getStats(req.session.shopId);
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Vite Middleware (Development)
    if (process.env.NODE_ENV !== 'production') {
        try {
            const { createServer } = await import('vite');
            const vite = await createServer({
                server: { middlewareMode: true },
                appType: 'spa',
                root: path.join(__dirname, '../client'),
                configFile: path.join(__dirname, '../client/vite.config.js')
            });
            app.use(vite.middlewares);
            
            // Serve index.html for unknown routes (SPA fallback)
            app.use('*', async (req, res, next) => {
                if (req.method !== 'GET' || (req.headers.accept && req.headers.accept.indexOf('text/html') === -1)) {
                    return next();
                }
                const url = req.originalUrl;
                try {
                    let template = fs.readFileSync(path.resolve(__dirname, '../client/index.html'), 'utf-8');
                    template = await vite.transformIndexHtml(url, template);
                    res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
                } catch (e) {
                    vite.ssrFixStacktrace(e);
                    next(e);
                }
            });

            console.log('✅ Vite middleware initialized');
        } catch (err) {
            console.error('❌ Failed to initialize Vite middleware:', err);
        }
    }

    // Serve Static Files (React Build - Production)
    if (process.env.NODE_ENV === 'production') {
        app.use(express.static(path.join(__dirname, '../client/dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/dist/index.html'));
        });
    }

    // Start Server
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Dashboard: http://localhost:${PORT}`);
        
        // Start WhatsApp Bots
        startAllBots().catch(err => console.error('Failed to start WhatsApp bots:', err));
    });
};

startServer();
