// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAZZR53xZtsQKFRzyHsu3BBKTtRRYAN4QI",
  authDomain: "umd-pixels.firebaseapp.com",
  projectId: "umd-pixels",
  storageBucket: "umd-pixels.firebasestorage.app",
  messagingSenderId: "33728542418",
  appId: "1:33728542418:web:59c259b489e7f471919f0b",
  measurementId: "G-3P821HDWMH"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Analytics (only on client side)
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, functions, analytics };
