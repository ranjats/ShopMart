# 🛒 WhatsApp Grocery Order Bot (WhatsApp किराना ऑर्डर बॉट)

A full-stack application to manage grocery orders via WhatsApp. Customers can send their grocery list to a WhatsApp number, and the shop owner can manage orders through a web dashboard.

यह व्हाट्सएप के माध्यम से किराना ऑर्डर प्रबंधित करने के लिए एक फुल-स्टैक एप्लिकेशन है। ग्राहक व्हाट्सएप नंबर पर अपनी किराना सूची भेज सकते हैं, और दुकानदार वेब डैशबोर्ड के माध्यम से ऑर्डर प्रबंधित कर सकते हैं।

---

## 🌟 Features (विशेषताएँ)

- **WhatsApp Bot**:
  - Auto-replies to greetings ("Hi Shop Name").
  - Validates grocery items against inventory.
  - Accepts orders and saves them to the database.
  - Sends real-time status updates (Preparing, Ready, Completed).
- **Web Dashboard**:
  - Secure Login for Shop Owner.
  - Real-time Order Management.
  - Inventory Management (Add/Remove items, Update Stock).
  - Daily Statistics.
- **Tech Stack**: Node.js, Express, SQLite, React, Tailwind CSS, Baileys (WhatsApp Web API).

---

## 📋 Prerequisites (आवश्यकताएँ)

- Node.js (v18 or higher)
- npm (Node Package Manager)
- A WhatsApp account on your phone (to scan QR code)

---

## 🚀 Installation & Setup (इंस्टॉलेशन और सेटअप)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd grocery-whatsapp-bot
```

### 2. Install Dependencies
```bash
npm run install-all
```
This command installs dependencies for both the server and the client.
(यह कमांड सर्वर और क्लाइंट दोनों के लिए डिपेंडेंसी इंस्टॉल करता है।)

### 3. Configure Environment Variables
Copy the example environment file and edit it:
```bash
cp .env.example .env
```
Open `.env` and update the following:
- `SHOP_NAME`: Your shop's name.
- `DASHBOARD_PASSWORD`: Password for the admin dashboard.

### 4. Start the Application
```bash
npm run dev
```
This will start both the backend server (port 3000) and the frontend client.

---

## 📱 First-Time Setup (पहली बार सेटअप)

1. **Scan QR Code**:
   - Check your terminal/console. You will see a QR code.
   - Open WhatsApp on your phone -> Linked Devices -> Link a Device.
   - Scan the QR code.
   - Once connected, you will see "✅ WhatsApp connection opened!".

2. **Access Dashboard**:
   - Open `http://localhost:5173` (or `http://localhost:3000` if built) in your browser.
   - Login using the password set in `.env` (Default: `admin`).

3. **Add Inventory**:
   - Go to "Manage Inventory" in the dashboard.
   - Add items (e.g., "Rice", "Sugar", "Soap") with their prices.
   - **Important**: The bot only accepts orders for items that exist in the inventory!

---

## 🛒 Usage Instructions for Customers (ग्राहकों के लिए निर्देश)

1. **Start Chat**: Send `Hi [Shop Name]` (e.g., "Hi LumenLearn Shop").
2. **Receive Welcome**: Bot will reply with a welcome message.
3. **Send List**: Send the grocery list.
   - Example: `1kg Rice, 2 Soaps, 500g Sugar`
4. **Order Confirmation**: If items are in stock, the bot confirms the order with an Order ID.
5. **Updates**: Customer receives updates when status changes to "Preparing", "Ready", etc.

---

## ☁️ Deployment Guide (Railway.app)

1. **Create Account**: Sign up on [Railway.app](https://railway.app/).
2. **New Project**: Click "New Project" -> "Deploy from GitHub repo".
3. **Select Repo**: Choose this repository.
4. **Variables**: Go to "Variables" tab and add:
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `DASHBOARD_PASSWORD`: `your_secure_password`
   - `SHOP_NAME`: `Your Shop Name`
5. **Build Command**: Railway should auto-detect, but ensure the start command is `npm start`.
   - *Note*: You might need to adjust the build command to build the React client first if deploying as a monorepo, or deploy server and client separately. For simplicity, this repo serves the React build from the Express server.
   - **Build Command**: `npm run install-all && npm run build`
   - **Start Command**: `npm start`

---

## 🛠 Troubleshooting (समस्या निवारण)

- **WhatsApp Disconnected?**
  - Restart the server (`npm run dev`).
  - If the session is invalid, delete the `auth_info_baileys` folder and rescan the QR code.
- **Database Locked?**
  - Ensure you have write permissions to the `server/config` directory.
- **Port in Use?**
  - Change `PORT` in `.env` file.

---

## 🔮 Future Enhancements

- Payment Gateway Integration (UPI).
- Multi-language support (Hindi/English toggle).
- Image recognition for handwritten lists.

---

## 📄 License

MIT License. Created by [Your Name].
