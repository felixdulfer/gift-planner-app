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
