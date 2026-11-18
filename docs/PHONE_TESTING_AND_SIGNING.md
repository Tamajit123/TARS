# TARS preview installation and phone testing

## Current project and web preview

- Expo: `@tamajit123/tars-ai`, project `f9f92e27-d222-4a0f-ae50-6263521fdb27`.
- App IDs: `app.tarsai.mobile` on both platforms; native callback `tarsai://auth/callback`.
- Web preview: https://tars-ai--preview.expo.app
- Current immutable deployment: https://tars-ai--8e8nwficyu.expo.app
- The preview alias and immutable deployments' `/auth/callback` URLs were added and verified in the existing Supabase project. Existing callbacks and Site URL were preserved.
- The preview environment contains only the existing public Supabase URL and anon key. Gemini and other provider secrets remain on the existing Supabase backend; no provider or account was replaced.

## Android: existing signing key

The `preview` profile produces a directly installable APK using the existing remote keystore. A Play developer account is not required for this internal APK.

1. Open the successful build's installation link from the Expo project Builds page on your Android phone. Download the APK, rather than the older production AAB.
2. If Android prompts, allow installation from the browser or Files app used for this APK. Install TARS and turn that install permission back off afterward if desired. Do not disable Play Protect or bypass a security warning; report any warning.
3. If an existing TARS installation has the same signing certificate, install as an update. Do not uninstall to resolve a signature conflict: that deletes device-local alarms and drafts. Confirm the signing key/package first.
4. Sign in with the existing TARS Google account owning your integrations. No reconnection or account copying is needed.
5. Allow microphone and notifications only when testing those features. For alarms/timers, grant Android's **Alarms & reminders** access when requested and enable sound for the TARS alert channel.

To queue another identical preview from this repository:

```powershell
eas build --profile preview --platform android --non-interactive --freeze-credentials --no-wait
```

## iPhone: signing currently blocked

The account owner confirmed an iPhone is available but there is no Apple Developer Program membership. EAS found no suitable internal-distribution credentials. No signed IPA or iPhone installation is claimed.

### EAS installation path

1. Enroll an Apple account in the Apple Developer Program if you choose this route. Enrollment/payment and Apple agreements must be completed by the account owner.
2. In a terminal in `D:\TARS`, run `eas whoami` and `eas project:info`; confirm the existing Expo identity above.
3. Run `eas device:create`. Complete Apple sign-in/2FA yourself when prompted. Select your existing Apple team and open the generated device-registration URL in Safari on the actual iPhone. Complete device registration as directed; do not send passwords, verification codes or signing files in chat.
4. Run `eas credentials:configure-build --platform ios --profile preview`. Select `app.tarsai.mobile`; reuse an existing valid distribution certificate if available. Allow EAS to create an ad hoc provisioning profile containing the registered device. Do not revoke unrelated certificates or change the bundle ID.
5. Run `eas build --profile preview --platform ios`. Choose the registered iPhone when asked. Open the finished build's install link in Safari on that phone. If a device is added later, refresh provisioning and rebuild or use EAS re-signing.

### Free alternative requiring a Mac

A free Apple personal team can be used through Xcode for local testing on your own iPhone. This requires a Mac with Xcode and device pairing/signing under your own Apple account; it is not an EAS ad hoc distribution build. Run `npm ci`, then `npx expo run:ios --device` on the Mac and resolve signing in Xcode using the existing bundle ID where your team permits it. Free provisioning expires frequently and has capability/device restrictions. If the existing identifier belongs to another paid team, resolve that team access rather than silently renaming the application. A simulator build cannot be installed on an iPhone.

## Acceptance checklist on each physical phone

Record phone model, OS version, build ID, steps, expected result and actual result. A web preview or native prebuild is not a substitute for these checks.

| Test | Expected behavior |
| --- | --- |
| Google sign-in and restart | Existing owner, history and connections restored; native callback returns to TARS |
| Keyboard and navigation | Composer/Send/Voice visible; multiline input scrolls; chat and other tabs remain reachable after dismissing keyboard |
| Gemini text and connected read | Real final response after the execution card, or an honest provider error; no false success |
| Browserbase | Fresh live view loads and closes; expired sessions show Ended and can request a fresh preview |
| Attachments | Camera, system photos and document picker; allow/deny/cancel; private upload, preview, retry and reopen |
| Voice | Microphone denial/cancel; record, stop, preview, play, upload and Gemini analysis; interrupted recording does not produce a false success |
| One-time reminder | Schedule a reminder two minutes ahead with sound; lock phone and observe actual delivery; edit/snooze/complete/cancel without duplicate alerts |
| Recurring reminder | Verify next occurrence follows the phone's local clock and survives reopening; test on each device separately |
| Alarm and timer | Explicit OS acceptance, actual audible alert, cancellation and restart behavior; record silent/Focus outcomes separately |
| Privacy and recovery | Sign-out cancels only the owner's local alerts; network loss and retry preserve drafts/history |
| Theme/accessibility | Light/dark text, icons, contrast, large text and reduced motion remain usable |

Ordinary iOS notifications cannot guarantee ringing through Silent Mode or Focus. No AlarmKit entitlement or critical-alert bypass is configured or promised. Android exact-alarm access and battery restrictions also affect delivery. OSRM remains the development routing provider; paid Google APIs are not required or newly enabled.

## Evidence and known limitations

The initial Android build `facdc6bd-c9e7-4aee-9c78-7fbac71714cb` failed before compilation because `tars-alert.wav` violated Android resource naming rules. The asset/config/runtime were corrected to `tars_alert.wav`; a regression check was added. Missing direct `expo-asset` support for audio and `expo-system-ui` support for native theme behavior were added at SDK-compatible versions. Android native prebuild passed afterward. iOS native prebuild cannot run on this Windows host; its compile/sign/install checks remain pending.

Hosted `/`, `/auth/callback`, `/chat`, `/privacy` and `/terms` returned HTTP 200, the hosted entry bundle matched the verified local export, and the actual hosted sign-in screen rendered. Hosted authenticated flows still require signing in on that new origin. See [RELEASE_VERIFICATION_2026-11-18.md](RELEASE_VERIFICATION_2026-11-18.md) for the earlier application test matrix and provider limitations.

Official references: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/), [Expo iOS device builds](https://docs.expo.dev/build/setup/), [Apple membership comparison](https://developer.apple.com/support/compare-memberships/), [Expo hosting](https://docs.expo.dev/deploy/web/).
