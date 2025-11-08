import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const defaultConfig = {
  apiKey: "AIzaSyDhS6AwiVEEwvGWbrTifiQkpoiIP5LcQ4U",
  authDomain: "gift-planner-app-d8139.firebaseapp.com",
  projectId: "gift-planner-app-d8139",
  storageBucket: "gift-planner-app-d8139.firebasestorage.app",
  messagingSenderId: "158162123229",
  appId: "1:158162123229:web:eb47c522f20b9016e15e34",
  measurementId: "G-W9X0F5WFG7"
};

// Firebase configuration
// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || defaultConfig.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || defaultConfig.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || defaultConfig.appId,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with platform-specific persistence
// For web, use getAuth (default persistence)
// For React Native, we'll use getAuth and handle persistence manually
// since Firebase v12 doesn't properly support custom persistence adapters
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // For React Native, use getAuth
  // Note: Auth state won't persist automatically, but the app will work
  // You can manually persist auth state using AsyncStorage if needed
  auth = getAuth(app);
  
  // Optional: Manually handle auth state persistence
  // This is a workaround until Firebase properly supports React Native persistence
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in - you can manually save to AsyncStorage if needed
      try {
        await ReactNativeAsyncStorage.setItem('firebase_auth_user', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        }));
      } catch (error) {
        console.warn('Failed to save auth state:', error);
      }
    } else {
      // User is signed out
      try {
        await ReactNativeAsyncStorage.removeItem('firebase_auth_user');
      } catch (error) {
        console.warn('Failed to remove auth state:', error);
      }
    }
  });
}

export { auth };
export const db = getFirestore(app);

export default app;

