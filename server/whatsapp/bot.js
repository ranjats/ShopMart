const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { useFirestoreAuthState } = require("./firestoreAuthState");
const { pino } = require("pino");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const PDFDocument = require("pdfkit");

const bots = new Map(); // shopId -> { sock, qrCodeData, connectionStatus, shopName }
const userSessions = new Map(); // remoteJid -> { state, timestamp, shopId }

const generatePDFBill = async (
  shopName,
  orderId,
  pushName,
  validItems,
  totalBill,
) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Header
      doc.fontSize(20).text(shopName, { align: "center" });
      doc.moveDown();
      doc.fontSize(14).text("INVOICE / BILL", { align: "center" });
      doc.moveDown();

      // Order Info
      doc.fontSize(12).text(`Order ID: #${orderId}`);
      doc.text(
        `Date: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      );
      doc.text(`Customer: ${pushName}`);
      doc.moveDown();

      // Items Table Header
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      let headerY = doc.y;
      doc.text("Item", 50, headerY, { width: 300 });
      doc.text("Amount", 350, headerY, { width: 200, align: "right" });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      // Items
      validItems.forEach((item) => {
        let itemY = doc.y;
        doc.text(item.str, 50, itemY, { width: 300 });
        let nextY = doc.y;
        doc.text(`Rs. ${item.price.toFixed(2)}`, 350, itemY, { width: 200, align: "right" });
        doc.y = Math.max(nextY, doc.y) + 5;
      });

      // Total
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      let totalY = doc.y;
      doc.fontSize(14).text("Total Amount:", 50, totalY, { width: 300 });
      doc.text(`Rs. ${totalBill.toFixed(2)}`, 350, totalY, { width: 200, align: "right" });
      doc.y = Math.max(doc.y, totalY + 14) + 5;
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

      // Footer
      doc.moveDown(2);
      doc
        .fontSize(12)
        .text("Thank you for shopping with us!", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const connectToWhatsApp = async (shopId, shopName) => {
  if (!shopId) return;

  try {
    if (bots.has(shopId)) {
      const existingBot = bots.get(shopId);
      if (existingBot.sock) {
        try {
          existingBot.sock.ev.removeAllListeners("connection.update");
          existingBot.sock.ev.removeAllListeners("creds.update");
          existingBot.sock.ev.removeAllListeners("messages.upsert");
          existingBot.sock.end(undefined);
        } catch (e) {
          console.error(`Error closing existing socket for shop ${shopId}:`, e);
        }
      }
    }

    bots.set(shopId, {
      sock: null,
      qrCodeData: null,
      connectionStatus: "connecting",
      shopName: shopName,
    });

    const { state, saveCreds, removeSession } =
      await useFirestoreAuthState(shopId);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }), // Hide noisy logs
      printQRInTerminal: false,
      auth: state,
      browser: [shopName || "Grocery Bot", "Chrome", "1.0.0"],
      syncFullHistory: false,
      connectTimeoutMs: 60000, // 60 seconds timeout
    });

    const botState = bots.get(shopId);
    botState.sock = sock;

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        botState.qrCodeData = qr;
        botState.connectionStatus = "connecting";
        console.log(`QR Code generated for shop ${shopId}`);
      }

      if (connection === "close") {
        botState.qrCodeData = null;
        botState.connectionStatus = "disconnected";

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage =
          lastDisconnect?.error?.message || String(lastDisconnect?.error);

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isBadSession = statusCode === DisconnectReason.badSession;

        const shouldDeleteSession = isLoggedOut || isBadSession;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut; // Always try to reconnect unless explicitly logged out by user

        console.log(
          `❌ Connection closed for shop ${shopId}. Reason: ${statusCode} - ${errorMessage}`,
        );

        if (shouldDeleteSession) {
          console.log(
            `⚠️ Fatal session error or logout for shop ${shopId}. Deleting session from Firestore to force re-login.`,
          );
          await removeSession();
        }

        if (shouldReconnect) {
          console.log(`🔄 Reconnecting shop ${shopId} in 5 seconds...`);
          setTimeout(() => connectToWhatsApp(shopId, shopName), 5000);
        }
      } else if (connection === "open") {
        botState.qrCodeData = null;
        botState.connectionStatus = "connected";
        console.log(`✅ WhatsApp connection opened for shop ${shopId}!`);
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message) continue;

        const msgTimestamp = msg.messageTimestamp;
        const now = Math.floor(Date.now() / 1000);
        if (now - msgTimestamp > 10) continue;

        if (msg.key.fromMe) continue;

        await handleMessage(msg, shopId, shopName);
      }
    });
  } catch (error) {
    console.error(`Error connecting to WhatsApp for shop ${shopId}:`, error);
    console.log(`🔄 Retrying connection for shop ${shopId} in 10 seconds...`);
    setTimeout(() => connectToWhatsApp(shopId, shopName), 10000);
  }
};

const handleMessage = async (msg, shopId, shopName) => {
  const remoteJid = msg.key?.remoteJid;
  const senderJid = msg.key?.participant || msg.key?.remoteJid;
  const pushName = msg.pushName || "Customer";

  // Ignore group messages
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;

  const text =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    "";

  if (!text) return;

  const lowerText = text.toLowerCase().trim();
  const lowerShopName = (shopName || "LumenLearn Shop").toLowerCase();

  // 1. Greeting Filter
  const greetingWords = [
    "hi",
    "hello",
    "hey",
    "hi there",
    "नमस्ते",
    "namaste",
    "start",
    "menu",
  ];
  const isGreeting =
    greetingWords.includes(lowerText) ||
    lowerText.includes(`hi ${lowerShopName}`) ||
    lowerText.includes(`hello ${lowerShopName}`) ||
    lowerText.includes(`नमस्ते ${lowerShopName}`);

  // Check if user has an active order for THIS shop
  let allOrders = [];
  try {
    allOrders = await db.getAllOrders(shopId);
  } catch (error) {
    console.error("Failed to get orders in handleMessage:", error);
    return; // Ignore message if we can't check orders
  }
  const activeOrder = allOrders.find(
    (o) => o.customer_phone === remoteJid && o.status !== "completed",
  );

  // 1.5 Inquiry Filter (Check if user is just asking for availability/price)
  const inquiryKeywords = [
    "hai kya",
    "available",
    "price",
    "kitne ka",
    "batao",
    "stock",
    "mil jayega",
    "milega",
    "hai ya nahi",
  ];
  const isInquiry = inquiryKeywords.some((kw) => lowerText.includes(kw));

  if (isInquiry) {
    let allProducts = [];
    try {
      allProducts = await db.getAllProducts(shopId);
    } catch (error) {
      console.error("Failed to get products for inquiry:", error);
      await sendMessage(
        remoteJid,
        "तकनीकी समस्या है। कृपया थोड़ी देर बाद प्रयास करें।",
        shopId,
      );
      return;
    }

    // Find which products they are asking about
    const foundProducts = allProducts.filter((p) =>
      lowerText.includes(p.name.toLowerCase()),
    );

    if (foundProducts.length > 0) {
      let reply = "जानकारी:\n\n";
      foundProducts.forEach((p) => {
        const stockStatus =
          p.in_stock && p.quantity > 0
            ? `✅ उपलब्ध है (स्टॉक: ${p.quantity})`
            : "❌ आउट ऑफ स्टॉक";
        reply += `*${p.name}*\nदाम: ₹${p.price}\nस्थिति: ${stockStatus}\n\n`;
      });
      reply +=
        "ऑर्डर करने के लिए, कृपया मात्रा के साथ आइटम का नाम भेजें (उदा: 1kg चावल)।";
      await sendMessage(remoteJid, reply, shopId);
    } else {
      await sendMessage(
        remoteJid,
        "क्षमा करें, मुझे यह आइटम हमारे कैटलॉग में नहीं मिला। कृपया किसी अन्य आइटम के बारे में पूछें या ऑर्डर करने के लिए अपनी लिस्ट भेजें।",
        shopId,
      );
    }

    // Ensure they are in an ordering session so they can reply with an order immediately
    userSessions.set(`${shopId}_${remoteJid}`, {
      state: "ordering",
      timestamp: Date.now(),
      shopId,
    });
    return;
  }

  if (isGreeting) {
    userSessions.set(`${shopId}_${remoteJid}`, {
      state: "ordering",
      timestamp: Date.now(),
      shopId,
    });
    if (activeOrder) {
      await sendMessage(
        remoteJid,
        `नमस्ते! आपका एक सक्रिय ऑर्डर (#${activeOrder.order_id}) अभी '${activeOrder.status}' स्थिति में है।\n\nयदि आप कुछ और ऑर्डर करना चाहते हैं, तो कृपया अपनी नई लिस्ट भेजें।`,
        shopId,
      );
    } else {
      await sendMessage(
        remoteJid,
        `नमस्ते! 🛒 *${shopName}* में आपका स्वागत है।\n\nकृपया अपनी grocery list भेजें।\nउदाहरण: 1kg चावल, 2 परले-जी, आधा kg नमक`,
        shopId,
      );
    }
    return;
  }

  // Status Check Filter
  const statusKeywords = [
    "status",
    "kaha hai",
    "kab aayega",
    "mera order",
    "update",
  ];
  const isStatusCheck = statusKeywords.some((kw) => lowerText.includes(kw));
  if (isStatusCheck && activeOrder) {
    await sendMessage(
      remoteJid,
      `आपका ऑर्डर #${activeOrder.order_id} अभी '${activeOrder.status}' स्थिति में है। कृपया प्रतीक्षा करें।`,
      shopId,
    );
    return;
  }

  // Farewell Filter
  const farewellKeywords = [
    "thank you",
    "thanks",
    "bye",
    "goodbye",
    "dhanyawad",
    "shukriya",
    "ok bye",
    "ok thanks",
    "alvida",
  ];
  const isFarewell = farewellKeywords.some((kw) => lowerText.includes(kw));
  if (isFarewell) {
    userSessions.delete(`${shopId}_${remoteJid}`);
    if (activeOrder) {
      await sendMessage(
        remoteJid,
        `धन्यवाद! 🙏 आपका ऑर्डर #${activeOrder.order_id} अभी '${activeOrder.status}' स्थिति में है। हम आपको अपडेट करेंगे।`,
        shopId,
      );
    } else {
      await sendMessage(
        remoteJid,
        `हमारे साथ खरीदारी करने के लिए धन्यवाद! 🙏\nआपका दिन शुभ हो।`,
        shopId,
      );
    }
    return;
  }

  // Check if in ordering session
  const session = userSessions.get(`${shopId}_${remoteJid}`);
  if (!session || session.state !== "ordering") {
    // If they just send random text and have an active order, remind them of status
    if (activeOrder) {
      await sendMessage(
        remoteJid,
        `आपका ऑर्डर #${activeOrder.order_id} अभी '${activeOrder.status}' स्थिति में है।\nनया ऑर्डर करने के लिए 'Hi' भेजें।`,
        shopId,
      );
    }
    return;
  }

  // 2. Order Processing
  const items = text
    .split(/,|\n|\band\b|\baur\b|&/i)
    .map((i) => i.trim())
    .filter((i) => i.length > 0);

  if (items.length > 0) {
    const unavailableItems = [];
    const validItems = [];
    const productsToUpdate = [];
    let totalBill = 0;

    let allProducts = [];
    try {
      allProducts = await db.getAllProducts(shopId);
    } catch (error) {
      console.error("Failed to get products in handleMessage:", error);
      await sendMessage(
        remoteJid,
        "तकनीकी समस्या के कारण आपका ऑर्डर प्रोसेस नहीं हो सका। कृपया थोड़ी देर बाद प्रयास करें।",
        shopId,
      );
      return;
    }

    // Sort products by length descending so longer names match first (e.g., "Tata Salt" before "Salt")
    allProducts.sort((a, b) => b.name.length - a.name.length);

    for (const itemStr of items) {
      let chunk = itemStr.toLowerCase();
      let foundAny = false;

      for (const product of allProducts) {
        const prodName = product.name.toLowerCase();
        const prodIndex = chunk.indexOf(prodName);

        if (prodIndex !== -1) {
          foundAny = true;

          // Try to find a number *before* the product name in this chunk
          const textBeforeProduct = chunk.substring(0, prodIndex);
          const matchBefore = textBeforeProduct.match(/(\d+(?:\.\d+)?)/g);

          let requestedQty = 1;
          if (matchBefore && matchBefore.length > 0) {
            // Take the last number before the product name
            requestedQty = parseFloat(matchBefore[matchBefore.length - 1]);
          } else {
            // Fallback: any number in the chunk
            const matchAny = chunk.match(/(\d+(?:\.\d+)?)/);
            if (matchAny) {
              requestedQty = parseFloat(matchAny[1]);
            }
          }

          if (product.in_stock && product.quantity >= requestedQty) {
            const itemTotal = requestedQty * product.price;
            validItems.push({
              str: `${requestedQty} x ${product.name}`,
              price: itemTotal,
            });
            totalBill += itemTotal;
            productsToUpdate.push({
              id: product.id,
              newQuantity: product.quantity - requestedQty,
            });
          } else {
            unavailableItems.push(
              `${product.name} (Only ${product.quantity} left in stock)`,
            );
          }

          // Remove the matched part so we can find other products in the same chunk
          chunk = chunk.replace(prodName, "");
        }
      }

      if (!foundAny && chunk.trim().length > 2) {
        unavailableItems.push(`${itemStr} (Not found in catalog)`);
      }
    }

    if (unavailableItems.length > 0) {
      await sendMessage(
        remoteJid,
        `क्षमा करें, निम्नलिखित आइटम उपलब्ध नहीं हैं या स्टॉक में कम हैं:\n\n❌ ${unavailableItems.join("\n❌ ")}\n\nकृपया उपलब्ध आइटम के साथ पुनः प्रयास करें।`,
        shopId,
      );
      return;
    }

    // Create Order
    const orderId = `ORD${Date.now().toString().slice(-4)}`;
    try {
      const itemsString = validItems
        .map((i) => `${i.str} (₹${i.price})`)
        .join("\n");
      await db.createOrder({
        order_id: orderId,
        customer_phone: remoteJid,
        customer_name: pushName,
        items: itemsString,
        status: "pending",
        bill_amount: totalBill,
        shop_id: shopId,
      });

      for (const update of productsToUpdate) {
        await db.updateProductQuantity(update.id, update.newQuantity, shopId);
      }

      userSessions.delete(`${shopId}_${remoteJid}`);

      // Generate a structured text bill
      const dateStr = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      let billText = `*🧾 ${shopName} - INVOICE*\n`;
      billText += `--------------------------------\n`;
      billText += `*Order ID:* #${orderId}\n`;
      billText += `*Date:* ${dateStr}\n`;
      billText += `*Customer:* ${pushName}\n`;
      billText += `--------------------------------\n`;
      billText += `*ITEMS:*\n`;
      validItems.forEach((item) => {
        billText += `▪ ${item.str} = ₹${item.price}\n`;
      });
      billText += `--------------------------------\n`;
      billText += `*TOTAL AMOUNT:* ₹${totalBill}\n`;
      billText += `--------------------------------\n`;
      billText += `✅ *Status:* Pending\n`;
      billText += `⏳ हम 15 मिनट में आपका ऑर्डर तैयार कर देंगे।\n`;
      billText += `🙏 *धन्यवाद! फिर पधारें।*`;

      await sendMessage(remoteJid, billText, shopId);

      try {
        const pdfBuffer = await generatePDFBill(
          shopName,
          orderId,
          pushName,
          validItems,
          totalBill,
        );
        await sendDocument(
          remoteJid,
          pdfBuffer,
          `Invoice_${orderId}.pdf`,
          "application/pdf",
          "📄 आपका बिल (PDF)",
          shopId,
        );
      } catch (pdfError) {
        console.error("Failed to generate/send PDF:", pdfError);
      }
    } catch (error) {
      console.error("Order creation failed:", error);
      await sendMessage(
        remoteJid,
        "तकनीकी समस्या के कारण आपका ऑर्डर प्रोसेस नहीं हो सका। कृपया थोड़ी देर बाद प्रयास करें।",
        shopId,
      );
    }
  } else {
    await sendMessage(
      remoteJid,
      `कृपया अपनी grocery list भेजें।\nउदाहरण: 1kg चावल, 2 परले-जी, आधा kg नमक`,
      shopId,
    );
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

const sendDocument = async (
  jid,
  buffer,
  fileName,
  mimetype,
  caption,
  shopId,
) => {
  const botState = bots.get(shopId);
  if (!botState || !botState.sock) return;
  try {
    await botState.sock.sendMessage(jid, {
      document: buffer,
      fileName: fileName,
      mimetype: mimetype,
      caption: caption,
    });
  } catch (error) {
    console.error(`Failed to send document for shop ${shopId}:`, error);
  }
};

const sendStatusUpdate = async (
  phone,
  status,
  orderId,
  billAmount = 0,
  shopId,
) => {
  const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  let message = "";

  switch (status) {
    case "preparing":
      message = `👨‍🍳 आपका ऑर्डर #${orderId} तैयार किया जा रहा है (Preparing)।`;
      break;
    case "ready":
      message = `✅ आपका ऑर्डर #${orderId} तैयार है (Ready)! कृपया इसे पिक अप करें।\n\n💰 *Total Bill: ₹${billAmount}*`;
      break;
    case "completed":
      message = `🎉 आपका ऑर्डर #${orderId} पूरा हो गया है (Completed)। हमारे साथ खरीदारी करने के लिए धन्यवाद!`;
      break;
    default:
      return;
  }

  await sendMessage(jid, message, shopId);
};

const getConnectionStatus = (shopId) => {
  const botState = bots.get(shopId);
  if (!botState) return { status: "disconnected", qr: null };
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
  startAllBots,
};
