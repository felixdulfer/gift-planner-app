# Gift Planner App 👋

A React Native gift planning app built with Expo and Firebase, allowing users to
create events, manage wishlists, assign gifts, and track purchases.

## Tech Stack

- **Framework**: Expo (React Native)
- **Routing**: Expo Router
- **Language**: TypeScript
- **Backend**: Firebase (Authentication, Firestore)
- **Package Manager**: Bun

## Get started

1. Install dependencies

   ```bash
   bun install
   ```

2. Set up Firebase (see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))

3. Start the app

   ```bash
   bun start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Features

- User authentication (Email/Password, Google Sign-In)
- Event management with invitations
- Wishlist creation and management
- Gift assignment system
- Purchase tracking
- Real-time updates with Firestore

## Development

This project uses **Bun** as the package manager. All commands should use `bun` instead of `npm`:

- Install dependencies: `bun install`
- Add a package: `bun add <package-name>`
- Run scripts: `bun run <script-name>`

### Firebase Emulators

This project supports using Firebase emulators for local development, which allows you to develop and test without connecting to a live Firebase project.

#### Using Firebase Emulators

1. **Enable emulators** by setting the environment variable:

   ```bash
   echo 'EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true' > .env.local
   ```

2. **Start the Firebase emulators**:

   ```bash
   bun run emulators
   ```

   This will start:
   - Auth emulator on port `9099`
   - Firestore emulator on port `8080`
   - Emulator UI on port `4000` (visit http://localhost:4000)

3. **Start your app** in another terminal:

   ```bash
   bun run ios    # or android, web
   ```

   The app will automatically connect to the local emulators.

#### Running Commands with Emulators

Use `emulators:exec` to run commands (like tests) with emulators, which will automatically start and stop them:

```bash
bun run emulators:exec "bun test"
```

#### Disabling Emulators

To use a real Firebase project instead:

1. Remove or set `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=false` in `.env.local`
2. Configure your Firebase credentials in `.env.local` (see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))

**Note:** When using worktrees, emulators are automatically configured. Just start them with `bun run emulators` when needed.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our
  [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll
  create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
