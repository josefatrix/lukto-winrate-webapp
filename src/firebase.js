import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, browserSessionPersistence, setPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAa2ZX-7Ajwy6Ln7bb7vmNpDmiOtDpheOY",
  authDomain: "lukto-tracker.firebaseapp.com",
  projectId: "lukto-tracker",
  storageBucket: "lukto-tracker.firebasestorage.app",
  messagingSenderId: "343988138305",
  appId: "1:343988138305:web:2f15c59d4ebb915ebab1c0",
  measurementId: "G-T716P37FVM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with fallback persistence for iOS Safari
export const auth = getAuth(app);

// Try to set persistence - falls back gracefully on iOS
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // If local persistence fails (iOS private mode), use session
    setPersistence(auth, browserSessionPersistence).catch(() => {
      console.log('Using in-memory persistence');
    });
  });
} catch (e) {
  console.log('Persistence setup skipped');
}

export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with error handling for iOS
let db;
try {
  // Try to use persistent cache (better offline support)
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback to standard Firestore if persistent cache fails (iOS private mode)
  console.log('Using standard Firestore (no offline cache)');
  db = getFirestore(app);
}

export { db };
