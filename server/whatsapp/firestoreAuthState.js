const { initAuthCreds, BufferJSON, proto } = require('@whiskeysockets/baileys');
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');
const { db } = require('../config/db');

/**
 * Custom auth state for Baileys using Firebase Firestore.
 * This allows WhatsApp sessions to persist across server restarts without needing a local disk.
 */
const useFirestoreAuthState = async (shopId) => {
    const writeData = async (data, file) => {
        try {
            const docRef = doc(db, 'whatsapp_sessions', shopId, 'data', file);
            const sessionData = JSON.stringify(data, BufferJSON.replacer);
            await setDoc(docRef, { data: sessionData });
        } catch (error) {
            console.error(`Error writing ${file} for shop ${shopId} to Firestore:`, error);
        }
    };

    const readData = async (file) => {
        try {
            const docRef = doc(db, 'whatsapp_sessions', shopId, 'data', file);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data = snapshot.data().data;
                return JSON.parse(data, BufferJSON.reviver);
            }
        } catch (error) {
            console.error(`Error reading ${file} for shop ${shopId} from Firestore:`, error);
        }
        return null;
    };

    const removeData = async (file) => {
        try {
            const docRef = doc(db, 'whatsapp_sessions', shopId, 'data', file);
            await deleteDoc(docRef);
        } catch (error) {
            // Ignore missing document errors
        }
    };

    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

    const creds = (await readData('creds.json')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(fixFileName(`${type}-${id}.json`));
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = fixFileName(`${category}-${id}.json`);
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds.json');
        },
        removeSession: async () => {
            try {
                const q = collection(db, 'whatsapp_sessions', shopId, 'data');
                const snapshot = await getDocs(q);
                const deletePromises = [];
                snapshot.forEach(docSnap => {
                    deletePromises.push(deleteDoc(docSnap.ref));
                });
                await Promise.all(deletePromises);
            } catch (error) {
                console.error(`Error removing session for shop ${shopId}:`, error);
            }
        }
    };
};

module.exports = { useFirestoreAuthState };
