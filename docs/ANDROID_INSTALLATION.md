# Android installation

## Expo Go preview

Install Expo Go from Google Play. Run `npm install` and `npm run start`, scan the QR code, and choose **Explore offline preview**. For network discovery trouble use `npx expo start --tunnel`.

## Direct APK installation

The EAS `preview` profile is configured to produce an APK. Sign in to Expo, add the public Supabase variables to the intended EAS environment if needed, then run:

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

When EAS finishes, open the build page’s install link on the Android device, allow installation from that source if Android prompts, then install the APK. Alternatively download the artifact and use:

```powershell
adb install .\path\to\tars-ai.apk
```

EAS generates or uses the Android keystore for signing. Keep the EAS-managed credentials private; do not commit a keystore or export it into the repository.

## Play Store AAB

The production profile defaults to an Android App Bundle for Play Store submission:

```powershell
npx eas-cli build --platform android --profile production
```

Create the Play Console app listing and complete the required store configuration before submission. AABs are not directly installable on phones; use the preview APK profile for direct device installs. EAS Build’s [APK documentation](https://docs.expo.dev/build-reference/apk/) describes the profile behavior and direct install path.
