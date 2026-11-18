# TARS deployment plan — 18 November 2026

The existing Supabase backend is deployed. GitHub delivery and JavaScript exports do not constitute an App Store release or a signed device build. Start with a preview release; promote after the checks below.

## Preserve existing identities

- Supabase: `bdswodobwesadjedzhfg`. Do not run `supabase projects create`, reset the database, relink to another project or recreate Composio auth configs.
- Expo/EAS: `f9f92e27-d222-4a0f-ae50-6263521fdb27`.
- iOS bundle and Android package: `app.tarsai.mobile`; native scheme: `tarsai`.
- Existing `eas.json` already defines development, internal preview and production profiles. Keep that configuration.

## 1. Preview environment

Verify the EAS account/project using `npx eas-cli whoami` and `npx eas-cli project:info`. Configure only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the chosen EAS environment, using the existing project's public values. Local ignored `.env` files are not a cloud-build configuration. Provider credentials remain exclusively in existing Supabase Edge Function secrets.

Gemini remains explicitly selected: `AI_PROVIDER=gemini`, `AI_MODEL=gemini-3.5-flash-lite`. Do not enable OpenAI billing or switch providers automatically. Monitor actual quota/503 errors. Browserbase Search/Fetch and universal responses are enabled in the existing project.

## 2. Web preview

```powershell
npm ci
npm run typecheck
npm run typecheck:edge
npm run lint
npm test
npx expo export --platform web
npx eas-cli deploy --environment preview
```

Before testing the hosted preview, add its exact HTTPS `/auth/callback` URL to the existing Supabase Auth redirect allow list. Keep current native and localhost redirects. Google continues to redirect through the existing Supabase OAuth callback; never place OAuth client secrets in the client or replace the Supabase project. Verify sign-in, saved history, source links, Browserbase iframe/live expiry and private uploads on the actual HTTPS origin.

## 3. Native internal builds

```powershell
npx eas-cli build --profile preview --platform all
```

Use a signed development/internal build for Expo Audio, notifications, native Maps and permission testing. Actual EAS builds, signing credentials and developer-account access were not exercised in this Windows verification run. Register iOS test devices and complete signing through EAS with the account owner when required; keep signing credentials out of Git.

On a real iPhone and Android phone, verify keyboard opening/closing, multiline drafts, safe areas, recording interruptions, audio playback, camera/photos/files permissions including denial, private-upload failure/retry, notification permission denial, reminder edits/completion, app restart and offline recovery. Ordinary notification sound does not guarantee ringing through Silent Mode or Focus. Native Android resize configuration requires a rebuilt binary.

## 4. Production gate

Use [RELEASE_VERIFICATION_2026-11-18.md](RELEASE_VERIFICATION_2026-11-18.md) as the acceptance record. Resolve Reddit's provider HTTP 429 and Instagram's professional-account restriction if those integrations are required for launch. Dedicated live bookable travel offers are not configured. Finish the unverified universal-category matrix and physical-device checks before advertising those capabilities as production-certified.

After preview acceptance, use the repository's normal review/merge workflow, then:

```powershell
npx eas-cli build --profile production --platform all
```

Distribute through TestFlight/Play internal testing first. Store submissions and public rollout remain a separate release action after reviewing the signed builds, account requirements, privacy disclosures and store metadata. No store submission or public web production deployment was performed here.

## Operations and rollback

Keep the existing migrations tracked; both new migrations are additive. Monitor request completion/error codes, provider latency, quota, browser-session cleanup and scheduler executions without logging prompts, tokens or provider bodies. Retain original source timestamps and label cached information.

For an urgent rich-response rollback, set `TARS_UNIVERSAL_RESPONSES=false` in the same project's Edge Function secrets. This retains ordinary Gemini chat, existing connections, data and schema. Roll back the client to a previously accepted build if needed; do not drop tables, wipe history or undo migrations destructively.

Sources: [Expo build profiles](https://docs.expo.dev/build/eas-json/), [production builds](https://docs.expo.dev/deploy/build-project/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [web deployment](https://docs.expo.dev/deploy/web/).
