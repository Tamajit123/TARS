# Install on iPhone

## Fast preview with Expo Go

This is the quickest way to try the offline preview; it does not create an iOS build.

1. Install **Expo Go** from the App Store.
2. On the development computer, run `npm install` and `npm run start`.
3. Keep the iPhone and computer on the same Wi-Fi network. If discovery is blocked, run `npx expo start --tunnel` instead.
4. Scan the QR code with the iPhone Camera and open it in Expo Go.
5. Choose **Explore offline preview**.

## Install a standalone iOS app from Windows

This project is developed in Windows. Windows cannot run Xcode, an iOS Simulator, or a local iOS native build. EAS Build can compile the iOS binary in Expo’s cloud, but installing a development/ad hoc build on a physical iPhone requires Apple signing and provisioning. Expo’s current EAS guidance requires an Apple Developer account authorized to create certificates, identifiers, and provisioning profiles for device builds: [Expo Apple credential requirements](https://docs.expo.dev/app-signing/apple-developer-program-roles-and-permissions/).

1. Create an Expo account and enroll in the Apple Developer Program. The Apple Account Holder or an appropriately authorized organization administrator must create signing credentials.
2. Add the public Supabase URL and anon/publishable key to the Expo project’s EAS environment. Add server-only keys to Supabase, never EAS client variables.
3. In the project folder, sign in and configure EAS once:

   ```powershell
   npx eas-cli login
   npx eas-cli build:configure
   ```

   If EAS edits `app.json`, keep the configured `extra.eas.projectId`.

4. Register the iPhone UDID for an ad hoc preview build:

   ```powershell
   npx eas-cli device:create
   ```

   Follow the EAS page on the iPhone to register it. The iOS preview build is installable only on devices included in its provisioning profile. If you add another device later, create a new build after registration.

5. Build the app from Windows using EAS cloud:

   ```powershell
   npx eas-cli build --platform ios --profile preview
   ```

6. When the build finishes, open its install link on the registered iPhone and follow the prompts. On iOS 16+, enable Developer Mode if iOS requests it for an internal/development build: [Expo iOS Developer Mode](https://docs.expo.dev/guides/ios-developer-mode/).

For a development client with live Metro reloads, use `--profile development`; for a simulator binary, the profile needs `ios.simulator: true` and still requires EAS cloud from this Windows machine. `npm run ios` works only on macOS with Xcode installed.

Apple signing and provisioning profiles expire or need updating when capabilities change. A public App Store release uses the production profile and App Store Connect submission; it is not installed by scanning the internal preview link.
