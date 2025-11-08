import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { initializeApp } from "firebase/app";
// getReactNativePersistence exists at runtime but may not be in TypeScript types
// @ts-ignore
import { Auth, connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Check if we should use Firebase emulators
// Try multiple ways to access the environment variable
// Only use emulators if explicitly enabled (set to "true")
const envVar =
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR ||
  Constants.expoConfig?.extra?.useFirebaseEmulator;
const USE_EMULATOR = envVar === "true" || envVar === true;

// Firebase configuration
// For emulators, we can use dummy values
const firebaseConfig = USE_EMULATOR
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-project.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo-project.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef",
    }
  : {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with platform-specific persistence
// For web, use getAuth (default persistence)
// For React Native, use initializeAuth with AsyncStorage persistence
let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // For React Native, use initializeAuth with AsyncStorage persistence
  // If initializeAuth fails (e.g., already initialized), fall back to getAuth
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch (error: any) {
    // Auth might already be initialized (e.g., during hot reload)
    if (error.code === "auth/already-initialized") {
      auth = getAuth(app);
    } else {
      throw error;
    }
  }
}

export { auth };
export const db = getFirestore(app);

// Connect to emulators if enabled
if (USE_EMULATOR) {
  // Determine the emulator host based on platform
  let authHost = "localhost";
  let firestoreHost = "localhost";

  if (Platform.OS === "android") {
    // Android emulator uses 10.0.2.2 to access host machine's localhost
    authHost = "10.0.2.2";
    firestoreHost = "10.0.2.2";
  }
  // iOS simulator and web use localhost directly

  try {
    // Connect Auth emulator (port 9099)
    // Note: connectAuthEmulator can only be called once
    connectAuthEmulator(auth, `http://${authHost}:9099`, {
      disableWarnings: true,
    });
    console.log(`Connected to Auth emulator at http://${authHost}:9099`);
  } catch (error: any) {
    // Emulator might already be connected
    if (!error.message?.includes("already")) {
      console.warn("Failed to connect Auth emulator:", error);
    }
  }

  try {
    // Connect Firestore emulator (port 8080)
    // Note: connectFirestoreEmulator can only be called once
    connectFirestoreEmulator(db, firestoreHost, 8080);
    console.log(`Connected to Firestore emulator at ${firestoreHost}:8080`);
  } catch (error: any) {
    // Emulator might already be connected
    if (!error.message?.includes("already")) {
      console.warn("Failed to connect Firestore emulator:", error);
    }
  }
}

export default app;
