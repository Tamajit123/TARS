# TARS preview deployment — 18 November 2026

## Delivered web preview

- Preview URL: https://tars-ai--preview.expo.app
- Current immutable deployment: https://tars-ai--8e8nwficyu.expo.app
- Existing Expo project: `@tamajit123/tars-ai` / `f9f92e27-d222-4a0f-ae50-6263521fdb27`.
- Existing Supabase project: `bdswodobwesadjedzhfg`.
- Application/build source revision: `3e8207699b11865a5cdfd42be46d1b2fb3cf9dd1`; this report is a subsequent documentation update.

EAS preview environment now has the existing public Supabase URL and anon key. Both match the application's existing backend. No Gemini, Browserbase, Composio, OAuth client secret, service-role key or database password was copied to Expo. Gemini remains the existing server-selected provider/model. No database schema, user history, connection, auth config or project was replaced.

Supabase's exact preview alias and immutable callback URLs were added using supported config diff/push/read-back, with preservation checks. Every prior callback and the Site URL were retained. The earlier preview `xivadwgidr` remains an immutable deployment and its callback remains allowed.

## Actual verification

| Check | Result |
| --- | --- |
| Final web export | PASS: 1,727 client modules, 20 static routes |
| Hosted root, auth callback, chat, privacy, terms | PASS: HTTP 200 over HTTPS |
| Hosted entry JavaScript | PASS: SHA-256 equals the final local export |
| Actual hosted UI | PASS: TARS sign-in screen rendered in browser |
| New-origin authenticated workflows | NOT TESTED: user must sign in on the hosted origin; localhost cookies are not copied |
| Exported credential scan | PASS: 23 files, three known server credentials checked, zero matches |
| Regression suite after native fixes | PASS: 112 tests, zero failures |
| App TypeScript and lint | PASS |
| Android native prebuild | PASS locally and on the corrected EAS build |
| Native config introspection | PASS: original IDs/scheme, microphone/camera/location usage descriptions preserved |
| Corrected Android EAS build | IN PROGRESS at last check: Gradle compilation; prebuild, credentials preparation and JavaScript bundling passed |
| iOS signed build | BLOCKED: no suitable EAS internal credentials; owner confirmed no Apple Developer Program membership |
| Physical phone tests | NOT TESTED: installable artifact/device execution not verified |

## Android build

[Corrected preview build cd4afa22](https://expo.dev/accounts/tamajit123/projects/tars-ai/builds/cd4afa22-45cc-416b-9b2b-f19c54291de2) uses the existing remote keystore, package `app.tarsai.mobile`, internal distribution and APK output. An APK download/installation is not claimed while the status is in progress. Open this page for the finished installation link or error details.

The first cloud attempt `facdc6bd-c9e7-4aee-9c78-7fbac71714cb` failed during prebuild because a bundled sound name contained a hyphen. It was corrected to `tars_alert.wav` across asset/config/runtime/tests. SDK-compatible direct `expo-asset` and `expo-system-ui` dependencies/plugins were added for native audio and system-theme support. The corrected cloud run passed that phase. Expo Doctor still reported recommended SDK package-version updates as warnings; it no longer reported the missing audio peer dependency. No broad dependency upgrade or feature rewrite was performed.

## Owner actions

1. Open the web preview and sign in using the existing TARS account that owns your connections. Hosted sessions are independent of localhost.
2. When the Android build finishes, open its installation page on Android, install the APK and run the phone checklist.
3. For iPhone EAS installation, enroll in the Apple Developer Program, register the iPhone, and configure an ad hoc provisioning profile. Alternatively, free personal-device testing requires a Mac and Xcode; there is no installable EAS iPhone build from a free personal team.

Exact commands, signing steps, permission cases, keyboard/media/browser tests and notification limits are in [PHONE_TESTING_AND_SIGNING.md](PHONE_TESTING_AND_SIGNING.md). No production web promotion, Play Store upload, TestFlight submission or Apple enrollment/payment was performed.

Detailed evidence is retained under ignored `.database-audit/`: hosted route/bundle verification, callback preservation proof, cloud build status, regression output, native preflight and hosted screenshot. Existing provider limitations and incomplete universal-category tests remain documented in [RELEASE_VERIFICATION_2026-11-18.md](RELEASE_VERIFICATION_2026-11-18.md).
