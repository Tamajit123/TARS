# TARS

TARS is a React Native and Expo mobile app for conversation, ideas, recurring tasks, and activity. It is built for iOS and Android with TypeScript and Expo Router.

## Start now

Windows and macOS can run the offline preview without cloud credentials:

```powershell
npm install
npm run start
```

Install **Expo Go** on an iPhone or Android phone, keep the phone and development computer on the same network, then scan the terminal QR code. If the network blocks local discovery, run `npx expo start --tunnel`. In the app, choose **Explore offline preview**. Ideas, recurring-task drafts, and chat messages stay on that device. AI replies and cloud sync are intentionally unavailable until a backend is configured.

For cloud sign-in, chat, and synchronized data, follow [docs/SETUP.md](docs/SETUP.md). Windows can use EAS Build for iOS; it cannot run Xcode or build an iOS binary locally. See [docs/IOS_INSTALLATION.md](docs/IOS_INSTALLATION.md).

## Commands

```powershell
npm run start       # Expo development server
npm run android     # Open Android emulator, when Android Studio is installed
npm run ios         # iOS simulator; requires macOS and Xcode
npm run typecheck   # TypeScript check
npm run lint        # Expo lint
npm test            # Static security/schema regression checks
```

Build an installable Android APK:

```powershell
npx eas-cli build --platform android --profile preview
```

## Product and architecture

- Five destinations: Chat, Activity, Ideas, Tasks, and Settings.
- Device-local preview for chat history, ideas, and task drafts.
- Supabase Auth, Postgres, and RLS for configured cloud accounts.
- Authenticated Supabase Edge Function for AI replies. The provider key stays server-side.
- A separate authenticated schedule runner and optional scheduler secret for cron dispatch.
- TARS artwork is sourced from `TARS.png`; `assets/TARS-icon.png` is a square icon derivative for store and launcher requirements.

Read [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md) for the honest implementation status. The application is a development build, not a production-ready service. Cloud configuration, migrations, and provider behavior still need verification in your own accounts.

## Reference material and attribution

The Expo Router screen shell, chat layout, drawer, component patterns, and scheduling structure were adapted from the supplied Muse AI mobile clone (MIT license; attribution and license retained in `LICENSE`). `Free.zip` contained overlapping Supabase Edge Function and scheduling materials; those were reviewed and adapted. The separate AI-agent archive was inspected but its older onboarding and screen flows were not used. Original reference archives are kept under `references/` and excluded from future version control.

The reference YouTube video could not be retrieved by the available browser. The supplied codebase explanation was inspected locally and compared with the archived source.
