const { 
    default: makeWASocket, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { useFirestoreAuthState } = require('./firestoreAuthState');
const { pino } = require('pino');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const bots = new Map(); // shopId -> { sock, qrCodeData, connectionStatus, shopName }
const userSessions = new Map(); // remoteJid -> { state, timestamp, shopId }

const connectToWhatsApp = async (shopId, shopName) => {
    if (!shopId) return;

    if (bots.has(shopId)) {
        const existingBot = bots.get(shopId);
        if (existingBot.sock) {
            try {
                existingBot.sock.ev.removeAllListeners('connection.update');
                existingBot.sock.ev.removeAllListeners('creds.update');
                existingBot.sock.ev.removeAllListeners('messages.upsert');
                existingBot.sock.end(undefined);
            } catch (e) {
                console.error(`Error closing existing socket for shop ${shopId}:`, e);
            }
        }
    }

    bots.set(shopId, {
        sock: null,
        qrCodeData: null,
        connectionStatus: 'connecting',
        shopName: shopName
    });

    const { state, saveCreds, removeSession } = await useFirestoreAuthState(shopId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Hide noisy logs
        printQRInTerminal: false,
        auth: state,
        browser: [shopName || 'Grocery Bot', 'Chrome', '1.0.0'],
        syncFullHistory: false
    });

    const botState = bots.get(shopId);
    botState.sock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            botState.qrCodeData = qr;
            botState.connectionStatus = 'connecting';
            console.log(`QR Code generated for shop ${shopId}`);
        }

        if (connection === 'close') {
            botState.qrCodeData = null;
            botState.connectionStatus = 'disconnected';
            
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const errorMessage = lastDisconnect?.error?.message || String(lastDisconnect?.error);
            
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;
            const isBadSession = statusCode === DisconnectReason.badSession;
            const isConflict = statusCode === 409 || errorMessage.includes('conflict') || errorMessage.includes('Conflict');
            const isBadMac = errorMessage.includes('Bad MAC') || errorMessage.includes('decrypt');
            
            const shouldDeleteSession = isLoggedOut || isBadSession || isConflict || isBadMac;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut; // Always try to reconnect unless explicitly logged out by user

            console.log(`❌ Connection closed for shop ${shopId}. Reason: ${statusCode} - ${errorMessage}`);
            
            if (shouldDeleteSession) {
                console.log(`⚠️ Fatal session error or logout for shop ${shopId}. Deleting session from Firestore to force re-login.`);
                await removeSession();
            }

            if (shouldReconnect || shouldDeleteSession) {
                console.log(`🔄 Reconnecting shop ${shopId} in 3 seconds...`);
                setTimeout(() => connectToWhatsApp(shopId, shopName), 3000);
            }
        } else if (connection === 'open') {
            botState.qrCodeData = null;
            botState.connectionStatus = 'connected';
            console.log(`✅ WhatsApp connection opened for shop ${shopId}!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;
            
            const msgTimestamp = msg.messageTimestamp;
            const now = Math.floor(Date.now() / 1000);
            if (now - msgTimestamp > 10) continue;

            if (msg.key.fromMe) continue;

            await handleMessage(msg, shopId, shopName);
        }
    });
};

const handleMessage = async (msg, shopId, shopName) => {
    const remoteJid = msg.key?.remoteJid;
    const senderJid = msg.key?.participant || msg.key?.remoteJid;
    const pushName = msg.pushName || 'Customer';
    
    // Ignore group messages
    if (!remoteJid || remoteJid.endsWith('@g.us')) return;

    const text = msg.message?.conversation || 
                 msg.message?.extendedTextMessage?.text || 
                 msg.message?.imageMessage?.caption || '';

    if (!text) return;

    const lowerText = text.toLowerCase().trim();
    const lowerShopName = (shopName || 'LumenLearn Shop').toLowerCase();

    // 1. Greeting Filter
    const greetingWords = ['hi', 'hello', 'hey', 'hi there', 'नमस्ते', 'namaste', 'start', 'menu'];
    const isGreeting = greetingWords.includes(lowerText) || 
                       lowerText.includes(`hi ${lowerShopName}`) || 
                       lowerText.includes(`hello ${lowerShopName}`) || 
                       lowerText.includes(`नमस्ते ${lowerShopName}`);

    // Check if user has an active order for THIS shop
    let allOrders = [];
    try {
        allOrders = await db.getAllOrders(shopId);
    } catch (error) {
        console.error('Failed to get orders in handleMessage:', error);
        return; // Ignore message if we can't check orders
    }
    const activeOrder = allOrders.find(o => o.customer_phone === remoteJid && o.status !== 'completed');

    // 1.5 Inquiry Filter (Check if user is just asking for availability/price)
    const inquiryKeywords = ['hai kya', 'available', 'price', 'kitne ka', 'batao', 'stock', 'mil jayega', 'milega', 'hai ya nahi'];
    const isInquiry = inquiryKeywords.some(kw => lowerText.includes(kw));

    if (isInquiry) {
        let allProducts = [];
        try {
            allProducts = await db.getAllProducts(shopId);
        } catch (error) {
            console.error('Failed to get products for inquiry:', error);
            await sendMessage(remoteJid, 'तकनीकी समस्या है। कृपया थोड़ी देर बाद प्रयास करें।', shopId);
            return;
        }

        // Find which products they are asking about
        const foundProducts = allProducts.filter(p => lowerText.includes(p.name.toLowerCase()));
        
        if (foundProducts.length > 0) {
            let reply = "जानकारी:\n\n";
            foundProducts.forEach(p => {
                const stockStatus = (p.in_stock && p.quantity > 0) ? `✅ उपलब्ध है (स्टॉक: ${p.quantity})` : '❌ आउट ऑफ स्टॉक';
                reply += `*${p.name}*\nदाम: ₹${p.price}\nस्थिति: ${stockStatus}\n\n`;
            });
            reply += "ऑर्डर करने के लिए, कृपया मात्रा के साथ आइटम का नाम भेजें (उदा: 1kg चावल)।";
            await sendMessage(remoteJid, reply, shopId);
        } else {
            await sendMessage(remoteJid, "क्षमा करें, मुझे यह आइटम हमारे कैटलॉग में नहीं मिला। कृपया किसी अन्य आइटम के बारे में पूछें या ऑर्डर करने के लिए अपनी लिस्ट भेजें।", shopId);
        }
        
        // Ensure they are in an ordering session so they can reply with an order immediately
        userSessions.set(`${shopId}_${remoteJid}`, { state: 'ordering', timestamp: Date.now(), shopId });
        return;
    }

    if (isGreeting) {
        userSessions.set(`${shopId}_${remoteJid}`, { state: 'ordering', timestamp: Date.now(), shopId });
        if (activeOrder) {
            await sendMessage(remoteJid, `नमस्ते! आपका एक सक्रिय ऑर्डर (#${activeOrder.order_id}) अभी '${activeOrder.status}' स्थिति में है।\n\nयदि आप कुछ और ऑर्डर करना चाहते हैं, तो कृपया अपनी नई लिस्ट भेजें।`, shopId);
        } else {
            await sendMessage(remoteJid, `नमस्ते! 🛒 *${shopName}* में आपका स्वागत है।\n\nकृपया अपनी grocery list भेजें।\nउदाहरण: 1kg चावल, 2 परले-जी, आधा kg नमक`, shopId);
        }
        return;
    }

    // Status Check Filter
    const statusKeywords = ['status', 'kaha hai', 'kab aayega', 'mera order', 'update'];
    const isStatusCheck = statusKeywords.some(kw => lowerText.includes(kw));
    if (isStatusCheck && activeOrder) {
        await sendMessage(remoteJid, `आपका ऑर्डर #${activeOrder.order_id} अभी '${activeOrder.status}' स्थिति में है। कृपया प्रतीक्षा करें।`, shopId);
        return;
    }

    // Farewell Filter
    const farewellKeywords = ['thank you', 'thanks', 'bye', 'goodbye', 'dhanyawad', 'shukriya', 'ok bye', 'ok thanks', 'alvida'];
    const isFarewell = farewellKeywords.some(kw => lowerText.includes(kw));
    if (isFarewell) {
        userSessions.delete(`${shopId}_${remoteJid}`);
        await sendMessage(remoteJid, `हमारे साथ खरीदारी करने के लिए धन्यवाद! 🙏\nआपका दिन शुभ हो।`, shopId);
        return;
    }

    // Check if in ordering session
    const session = userSessions.get(`${shopId}_${remoteJid}`);
    if (!session || session.state !== 'ordering') {
        // If they just send random text and have an active order, remind them of status
        if (activeOrder) {
            await sendMessage(remoteJid, `आपका ऑर्डर #${activeOrder.order_id} अभी '${activeOrder.status}' स्थिति में है।\nनया ऑर्डर करने के लिए 'Hi' भेजें।`, shopId);
        }
        return;
    }

    // 2. Order Processing
    const items = text.split(/,|\n/).map(i => i.trim()).filter(i => i.length > 0);
    
    if (items.length > 0) {
        const unavailableItems = [];
        const validItems = [];
        const productsToUpdate = [];
        let totalBill = 0;

        let allProducts = [];
        try {
            allProducts = await db.getAllProducts(shopId);
        } catch (error) {
            console.error('Failed to get products in handleMessage:', error);
            await sendMessage(remoteJid, 'तकनीकी समस्या के कारण आपका ऑर्डर प्रोसेस नहीं हो सका। कृपया थोड़ी देर बाद प्रयास करें।', shopId);
            return;
        }

        for (const itemStr of items) {
            const match = itemStr.match(/(\d+(?:\.\d+)?)/);
            const requestedQty = match ? parseFloat(match[1]) : 1;
            
            let foundProduct = null;
            for (const product of allProducts) {
                if (itemStr.toLowerCase().includes(product.name.toLowerCase())) {
                    foundProduct = product;
                    break;
                }
            }

            if (foundProduct) {
                if (foundProduct.in_stock && foundProduct.quantity >= requestedQty) {
                    validItems.push(`${requestedQty} x ${foundProduct.name}`);
                    totalBill += requestedQty * foundProduct.price;
                    productsToUpdate.push({
                        id: foundProduct.id,
                        newQuantity: foundProduct.quantity - requestedQty
                    });
                } else {
                    unavailableItems.push(`${itemStr} (Only ${foundProduct.quantity} left in stock)`);
                }
            } else {
                unavailableItems.push(`${itemStr} (Not found in catalog)`);
            }
        }

        if (unavailableItems.length > 0) {
            await sendMessage(remoteJid, `क्षमा करें, निम्नलिखित आइटम उपलब्ध नहीं हैं या स्टॉक में कम हैं:\n\n❌ ${unavailableItems.join('\n❌ ')}\n\nकृपया उपलब्ध आइटम के साथ पुनः प्रयास करें।`, shopId);
            return;
        }

        // Create Order
        const orderId = `ORD${Date.now().toString().slice(-4)}`;
        try {
            await db.createOrder({
                order_id: orderId,
                customer_phone: remoteJid,
                customer_name: pushName,
                items: validItems.join('\n'),
                status: 'pending',
                bill_amount: totalBill,
                shop_id: shopId
            });

            for (const update of productsToUpdate) {
                await db.updateProductQuantity(update.id, update.newQuantity, shopId);
            }

            userSessions.delete(`${shopId}_${remoteJid}`);

            await sendMessage(remoteJid, `धन्यवाद! 🙏 आपका order मिल गया।\n\n🆔 Order ID: *#${orderId}*\n📋 Items:\n${validItems.join('\n')}\n\n💰 *Total Bill: ₹${totalBill}*\n\nहम 15 मिनट में ready कर देंगे।`, shopId);
            
        } catch (error) {
            console.error('Order creation failed:', error);
            await sendMessage(remoteJid, 'तकनीकी समस्या के कारण आपका ऑर्डर प्रोसेस नहीं हो सका। कृपया थोड़ी देर बाद प्रयास करें।', shopId);
        }
    } else {
        await sendMessage(remoteJid, `कृपया अपनी grocery list भेजें।\nउदाहरण: 1kg चावल, 2 परले-जी, आधा kg नमक`, shopId);
    }
};

const sendMessage = async (jid, text, shopId) => {
    const botState = bots.get(shopId);
    if (!botState || !botState.sock) return;
    try {
        await botState.sock.sendMessage(jid, { text });
    } catch (error) {
        console.error(`Failed to send message for shop ${shopId}:`, error);
    }
};

const sendStatusUpdate = async (phone, status, orderId, billAmount = 0, shopId) => {
    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
    let message = '';
    
    switch(status) {
        case 'preparing':
            message = `👨‍🍳 आपका ऑर्डर #${orderId} तैयार किया जा रहा है (Preparing)।`;
            break;
        case 'ready':
            message = `✅ आपका ऑर्डर #${orderId} तैयार है (Ready)! कृपया इसे पिक अप करें।\n\n💰 *Total Bill: ₹${billAmount}*`;
            break;
        case 'completed':
            message = `🎉 आपका ऑर्डर #${orderId} पूरा हो गया है (Completed)। हमारे साथ खरीदारी करने के लिए धन्यवाद!`;
            break;
        default:
            return;
    }
    
    await sendMessage(jid, message, shopId);
};

const getConnectionStatus = (shopId) => {
    const botState = bots.get(shopId);
    if (!botState) return { status: 'disconnected', qr: null };
    return { status: botState.connectionStatus, qr: botState.qrCodeData };
};

// Start all bots on boot
const startAllBots = async () => {
    try {
        const shops = await db.getAllShops();
        for (const shop of shops) {
            connectToWhatsApp(shop.mobile, shop.shopName);
        }
    } catch (err) {
        console.error("Failed to start all bots:", err);
    }
};

module.exports = {
    connectToWhatsApp,
    sendStatusUpdate,
    getConnectionStatus,
    startAllBots
};
