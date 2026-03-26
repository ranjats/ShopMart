const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');
const fs = require('fs');
const path = require('path');

// Load Firebase Config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig = {};
try {
    if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
        // Fallback to environment variables for production (e.g., Render)
        firebaseConfig = {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID,
            firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID
        };
    }
} catch (error) {
    console.error('❌ Failed to load Firebase configuration:', error);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Authenticate the backend bot anonymously
let authPromise = signInAnonymously(auth).then(() => {
    console.log('✅ Backend bot authenticated anonymously with Firebase');
}).catch((error) => {
    console.error('❌ Failed to authenticate backend bot anonymously:', error);
    console.log('⚠️ PLEASE ENABLE ANONYMOUS AUTHENTICATION IN FIREBASE CONSOLE ⚠️');
});

// Helper to format dates
const getISODate = () => new Date().toISOString();

// CRUD Operations

// Shops
const createShop = async (shopData) => {
    await authPromise;
    const { mobile, password, name, address, shopName } = shopData;
    try {
        const shopRef = doc(db, 'shops', mobile);
        const docSnap = await getDoc(shopRef);
        if (docSnap.exists()) {
            throw new Error('Shop with this mobile number already exists');
        }
        await setDoc(shopRef, {
            mobile,
            password,
            name,
            address,
            shopName,
            created_at: getISODate()
        });
        return { success: true, id: mobile, shopName };
    } catch (error) {
        console.error('Error creating shop:', error);
        throw error;
    }
};

const getShopByMobile = async (mobile) => {
    await authPromise;
    try {
        const docRef = doc(db, 'shops', mobile);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting shop:', error);
        throw error;
    }
};

const getAllShops = async () => {
    await authPromise;
    try {
        const snapshot = await getDocs(collection(db, 'shops'));
        let shops = [];
        snapshot.forEach(doc => {
            shops.push({ id: doc.id, ...doc.data() });
        });
        return shops;
    } catch (error) {
        console.error('Error getting all shops:', error);
        throw error;
    }
};

// Orders
const createOrder = async (orderData) => {
    await authPromise;
    const { order_id, customer_phone, customer_name, items, status, bill_amount, shop_id } = orderData;
    try {
        const orderRef = doc(collection(db, 'orders'));
        await setDoc(orderRef, {
            order_id,
            customer_phone,
            customer_name,
            items,
            status: status || 'pending',
            bill_amount: bill_amount || 0,
            shop_id,
            created_at: getISODate(),
            updated_at: getISODate()
        });
        return { success: true, order_id, id: orderRef.id };
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

const getAllOrders = async (shop_id, filters = {}) => {
    await authPromise;
    try {
        let q = query(collection(db, 'orders'), where('shop_id', '==', shop_id));
        const snapshot = await getDocs(q);
        let orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by created_at DESC
        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (filters.status) {
            orders = orders.filter(o => o.status === filters.status);
        }
        if (filters.date) {
            orders = orders.filter(o => o.created_at.startsWith(filters.date));
        }

        return orders;
    } catch (error) {
        console.error('Error getting orders:', error);
        throw error;
    }
};

const getOrderById = async (id, shop_id) => {
    await authPromise;
    try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().shop_id === shop_id) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        
        // If not found, try querying by order_id
        const q = query(collection(db, 'orders'), where('order_id', '==', id), where('shop_id', '==', shop_id));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const firstDoc = snapshot.docs[0];
            return { id: firstDoc.id, ...firstDoc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting order by ID:', error);
        throw error;
    }
};

const updateOrderStatus = async (id, status, shop_id, bill_amount = null) => {
    await authPromise;
    try {
        const order = await getOrderById(id, shop_id);
        if (!order) throw new Error('Order not found');

        const orderRef = doc(db, 'orders', order.id);
        const updateData = {
            status,
            updated_at: getISODate()
        };
        if (bill_amount !== null) {
            updateData.bill_amount = bill_amount;
        }

        await updateDoc(orderRef, updateData);
        
        return await getOrderById(order.id, shop_id);
    } catch (error) {
        console.error('Error updating order status:', error);
        throw error;
    }
};

const getStats = async (shop_id) => {
    await authPromise;
    try {
        const orders = await getAllOrders(shop_id);
        const todayStr = new Date().toISOString().split('T')[0];
        
        return {
            total: orders.length,
            pending: orders.filter(o => o.status === 'pending').length,
            completed: orders.filter(o => o.status === 'completed').length,
            today: orders.filter(o => o.created_at.startsWith(todayStr)).length
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        throw error;
    }
};

// Products
const getAllProducts = async (shop_id) => {
    await authPromise;
    try {
        const q = query(collection(db, 'products'), where('shop_id', '==', shop_id));
        const snapshot = await getDocs(q);
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        products.sort((a, b) => a.name.localeCompare(b.name));
        return products;
    } catch (error) {
        console.error('Error getting products:', error);
        throw error;
    }
};

const addProduct = async (name, price, quantity, shop_id) => {
    await authPromise;
    try {
        const in_stock = quantity > 0 ? 1 : 0;
        const productRef = doc(collection(db, 'products'));
        await setDoc(productRef, {
            name,
            price: parseFloat(price),
            quantity: parseInt(quantity, 10),
            in_stock,
            shop_id,
            created_at: getISODate()
        });
        return { id: productRef.id };
    } catch (error) {
        console.error('Error adding product:', error);
        throw error;
    }
};

const updateProduct = async (id, price, quantity, shop_id) => {
    await authPromise;
    try {
        const in_stock = quantity > 0 ? 1 : 0;
        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, {
            price: parseFloat(price),
            quantity: parseInt(quantity, 10),
            in_stock
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating product:', error);
        throw error;
    }
};

const updateProductQuantity = async (id, quantity, shop_id) => {
    await authPromise;
    try {
        const in_stock = quantity > 0 ? 1 : 0;
        const productRef = doc(db, 'products', id);
        await updateDoc(productRef, {
            quantity: parseInt(quantity, 10),
            in_stock
        });
        return { success: true };
    } catch (error) {
        console.error('Error updating product quantity:', error);
        throw error;
    }
};

const deleteProduct = async (id, shop_id) => {
    await authPromise;
    try {
        await deleteDoc(doc(db, 'products', id));
        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        throw error;
    }
};

const findProductByName = async (name, shop_id) => {
    await authPromise;
    try {
        const products = await getAllProducts(shop_id);
        return products.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
    } catch (error) {
        console.error('Error finding product:', error);
        throw error;
    }
};

module.exports = {
    db,
    createShop,
    getShopByMobile,
    getAllShops,
    createOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getStats,
    getAllProducts,
    addProduct,
    updateProduct,
    updateProductQuantity,
    deleteProduct,
    findProductByName
};
