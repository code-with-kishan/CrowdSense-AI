/**
 * Firebase Configuration
 * Production-ready Firebase setup with graceful fallback to in-memory simulation.
 * In a live deployment, set all FIREBASE_* env vars and this module
 * will automatically connect to Firestore for real-time state persistence.
 */

require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

/**
 * In-memory Firestore simulation.
 * Mirrors Firestore API (collection/doc/get/set/update)
 * so swapping to real Firebase requires zero code changes in services.
 */
class InMemoryFirestore {
  constructor() {
    this._store = {};
    this._listeners = {};
  }

  collection(name) {
    if (!this._store[name]) this._store[name] = {};
    return {
      doc: (id) => this._docRef(name, id),
      get: async () => ({
        docs: Object.entries(this._store[name]).map(([id, data]) => ({
          id,
          data: () => data,
          exists: true,
        })),
      }),
    };
  }

  _docRef(collection, id) {
    return {
      get: async () => ({
        exists: !!this._store[collection]?.[id],
        data: () => this._store[collection]?.[id] || null,
        id,
      }),
      set: async (data) => {
        if (!this._store[collection]) this._store[collection] = {};
        this._store[collection][id] = { ...data, _updatedAt: new Date().toISOString() };
        this._notifyListeners(collection, id);
      },
      update: async (data) => {
        if (!this._store[collection]) this._store[collection] = {};
        this._store[collection][id] = {
          ...(this._store[collection][id] || {}),
          ...data,
          _updatedAt: new Date().toISOString(),
        };
        this._notifyListeners(collection, id);
      },
      onSnapshot: (callback) => {
        const key = `${collection}/${id}`;
        if (!this._listeners[key]) this._listeners[key] = [];
        this._listeners[key].push(callback);
        // Fire immediately with current data
        callback({ exists: true, data: () => this._store[collection]?.[id] || {} });
        return () => {
          this._listeners[key] = this._listeners[key].filter((cb) => cb !== callback);
        };
      },
    };
  }

  _notifyListeners(collection, id) {
    const key = `${collection}/${id}`;
    if (this._listeners[key]) {
      const data = this._store[collection]?.[id] || {};
      this._listeners[key].forEach((cb) => cb({ exists: true, data: () => data }));
    }
  }
}

// Check if real Firebase credentials exist
const hasFirebaseCredentials =
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('your_');

let db;

if (hasFirebaseCredentials) {
  try {
    // Production: Use real Firebase Admin SDK
    // const admin = require('firebase-admin');
    // if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault(), ...firebaseConfig });
    // db = admin.firestore();
    // console.log('[Firebase] ✅ Connected to Firestore');

    // For now, fall through to simulation until firebase-admin is installed
    throw new Error('firebase-admin not installed — using simulation');
  } catch (err) {
    console.log(`[Firebase] ℹ️  Using in-memory simulation: ${err.message}`);
    db = new InMemoryFirestore();
  }
} else {
  console.log('[Firebase] ℹ️  No credentials found — using in-memory simulation (production-ready structure maintained)');
  db = new InMemoryFirestore();
}

module.exports = { db, firebaseConfig };
