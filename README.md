# TARS

TARS is a React Native and Expo mobile app for conversation, ideas, recurring tasks, and activity. It is built for iOS and Android with TypeScript and Expo Router.

Current executed results and release blockers: [16–17 November verification](docs/DELIVERY_2026-11-16.md). Use `npm run start` for local development. Native MapLibre, Google sign-in and device acceptance require a rebuilt development app; Expo Go is only a limited preview.

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

The Expo Router screen shell, chat layout, drawer, component patterns, and scheduling structure were adapted from the supplied Muse AI mobile clone (MIT license; attribution and license retained in `LICENSE`). `Free.zip` contained overlapping Supabase Edge Function and scheduling materials; those were reviewed and adapted. The separate AI-agent archive was inspected but its older onboarding and screen flows were not used. Reference checkouts, extracted screenshots, ZIP inspection material, and obsolete Node adapters are preserved outside the app in `D:\TARS-reference-archive-20261026`. See `docs/UI_REPAIR_REPORT.md` for the cleanup manifest.

The reference YouTube video could not be retrieved by the available browser. The supplied codebase explanation was inspected locally and compared with the archived source.
