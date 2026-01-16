import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

