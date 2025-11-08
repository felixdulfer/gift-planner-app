import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from './firebase';

// Complete the auth session for web browser
WebBrowser.maybeCompleteAuthSession();

// Check if Google sign-in is available
export const isGoogleSignInAvailable = (): boolean => {
  if (Platform.OS === 'web') {
    // Web always supports Google sign-in via popup
    return true;
  }
  
  // For mobile, check if Client ID is configured
  const clientIdEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const clientIdExtra = Constants.expoConfig?.extra?.googleClientId;
  const clientId = (typeof clientIdEnv === 'string' ? clientIdEnv : null) || 
                   (typeof clientIdExtra === 'string' ? clientIdExtra : null);
  
  return !!clientId;
};

export interface UserData {
  email: string;
  displayName: string;
  createdAt: Date;
}

export const signUp = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Update display name
    await updateProfile(user, { displayName });

    // Create user document in Firestore
    const userData: UserData = {
      email,
      displayName,
      createdAt: new Date(),
    };
    await setDoc(doc(db, 'users', user.uid), userData);

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create account');
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign in');
  }
};

// Platform-specific Google sign-in
// Web: uses signInWithPopup
// Mobile (iOS/Android): uses expo-auth-session with signInWithCredential
export const signInWithGoogle = async (): Promise<User> => {
  try {
    let userCredential;

    if (Platform.OS === 'web') {
      // Web platform: use signInWithPopup
      const provider = new GoogleAuthProvider();
      userCredential = await signInWithPopup(auth, provider);
    } else {
      // Mobile platform: use expo-auth-session
      const clientIdEnv = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
      const clientIdExtra = Constants.expoConfig?.extra?.googleClientId;
      const clientId = (typeof clientIdEnv === 'string' ? clientIdEnv : null) || 
                       (typeof clientIdExtra === 'string' ? clientIdExtra : null);
      
      if (!clientId) {
        throw new Error('Google OAuth client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in your environment variables.');
      }

      // Create the redirect URI
      const schemeValue = Constants.expoConfig?.scheme;
      const scheme: string = Array.isArray(schemeValue) 
        ? schemeValue[0] 
        : (schemeValue || 'giftplannerapp');
      const redirectUriResult = AuthSession.makeRedirectUri({
        scheme,
        path: 'redirect',
      });
      const redirectUri: string = Array.isArray(redirectUriResult) 
        ? redirectUriResult[0] 
        : redirectUriResult;

      // Request parameters for Google OAuth
      const request = new AuthSession.AuthRequest({
        clientId,
        scopes: ['openid', 'profile', 'email'],
        responseType: AuthSession.ResponseType.IdToken,
        redirectUri,
        extraParams: {},
      });

      // Get the discovery document
      const discovery = {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
      };

      // Prompt for authentication
      const result = await request.promptAsync(discovery);

      if (result.type !== 'success') {
        throw new Error('Google sign-in was cancelled or failed');
      }

      // Get the ID token from the result
      const idToken = result.params.id_token;
      if (!idToken || typeof idToken !== 'string') {
        throw new Error('Failed to get ID token from Google');
      }

      // Create a credential and sign in
      const credential = GoogleAuthProvider.credential(idToken);
      userCredential = await signInWithCredential(auth, credential);
    }

    const user = userCredential.user;

    // Check if user document exists, create if not
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      const userData: UserData = {
        email: user.email || '',
        displayName: user.displayName || '',
        createdAt: new Date(),
      };
      await setDoc(doc(db, 'users', user.uid), userData);
    }

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign in with Google');
  }
};

export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const getUserData = async (userId: string): Promise<UserData | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    return null;
  } catch (error: any) {
    // If it's a permissions error, return null instead of throwing
    // This allows the UI to show a fallback instead of crashing
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      console.warn(`Permission denied reading user ${userId}, user document may not exist or rules may not be deployed`);
      return null;
    }
    throw new Error(error.message || 'Failed to get user data');
  }
};

