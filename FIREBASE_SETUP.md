# Firebase Setup Guide

This guide will walk you through setting up Firebase for the Gift Planner App.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter a project name (e.g., "gift-planner-app")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Get Your Firebase Configuration

1. In the Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Register your app with a nickname (e.g., "Gift Planner Web")
6. Copy the Firebase configuration object

You'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

## Step 3: Configure Your App

### Option A: Using Environment Variables (Recommended)

1. Create a `.env.local` file in the root of your project:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id-here
```

## Step 4: Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable the following providers:
   - **Email/Password**: Click "Email/Password", toggle "Enable", click "Save"
   - **Google**: Click "Google", toggle "Enable", enter your support email, click "Save"

### Setting Up Google OAuth for Mobile (iOS/Android)

For Google sign-in to work on mobile devices, you need to configure OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required information
   - Add your email as a test user if in testing mode
6. Create OAuth client IDs:
   - **iOS**: Choose "iOS" as application type, enter your bundle ID (found in `app.json` or `app.config.js`)
   - **Android**: Choose "Android" as application type, enter your package name and SHA-1 certificate fingerprint
7. Copy the **Client ID** for each platform
8. Add the Client ID to your `.env.local` file:

```bash
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-ios-or-android-client-id-here
```

**Note**: For development, you can use the same Client ID for both platforms, but for production, use platform-specific Client IDs.

## Step 5: Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Choose your security rules:
   - **Start in test mode** (for development - allows all reads/writes)
   - **Start in production mode** (requires security rules)
4. Select a location for your database (choose the closest to your users)
5. Click "Enable"

## Step 6: Set Up Firestore Security Rules

1. In Firestore Database, go to the **Rules** tab
2. Replace the default rules with these:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function to check if user owns the document
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }

    // Events collection - users can read events they're members of
    match /events/{eventId} {
      allow read: if isAuthenticated() && request.auth.uid in resource.data.members;
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && request.auth.uid == resource.data.createdBy;
    }

    // Wishlists collection - users can read wishlists for events they're members of
    match /wishlists/{wishlistId} {
      allow read: if isAuthenticated() &&
        exists(/databases/$(database)/documents/events/$(resource.data.eventId)) &&
        request.auth.uid in get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.members;
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && request.auth.uid == resource.data.createdBy;
    }

    // Assignments collection - users can read assignments for events they're members of
    match /assignments/{assignmentId} {
      allow read: if isAuthenticated() &&
        exists(/databases/$(database)/documents/events/$(resource.data.eventId)) &&
        request.auth.uid in get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.members;
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() &&
        exists(/databases/$(database)/documents/events/$(resource.data.eventId)) &&
        request.auth.uid == get(/databases/$(database)/documents/events/$(resource.data.eventId)).data.createdBy;
    }
  }
}
```

3. Click "Publish" to save the rules

**Note**: For development, you can use test mode temporarily, but make sure to set proper rules before production!

## Step 7: Test Your Setup

1. Start your Expo app:

```bash
bun start
```

2. Try to:
   - Create an account
   - Log in
   - Create an event

If everything works, Firebase is configured correctly!

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"

- Make sure all environment variables are set correctly
- Restart your Expo development server after adding environment variables

### "Permission denied" errors

- Check your Firestore security rules
- Make sure you're authenticated before accessing data
- Verify the user is a member of the event they're trying to access

### Google Sign-In not working on mobile

- The app now uses `expo-auth-session` for mobile platforms (iOS/Android) and `signInWithPopup` for web
- Make sure you've set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in your environment variables
- Verify that Google OAuth is enabled in Firebase Console
- For iOS: Ensure your bundle ID matches the one configured in Google Cloud Console
- For Android: Ensure your package name and SHA-1 fingerprint match the ones in Google Cloud Console
- Restart your Expo development server after adding the environment variable

## Next Steps

- Set up Firebase Storage if you want to add image uploads for wishlist items
- Configure Cloud Functions for email invitations (optional)
- Set up push notifications (optional)
