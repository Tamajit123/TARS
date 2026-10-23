# Release checklist

## Before a device preview

- [ ] Add public Supabase variables to the intended EAS environment.
- [ ] Link the Supabase project and apply `supabase/migrations`.
- [ ] Deploy `chat` and set server-side provider secrets.
- [ ] Verify email OTP and OAuth redirect settings.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and Android/iOS Expo exports.
- [ ] Check two-account RLS isolation and failed/expired auth on real devices.
- [ ] Register the iPhone UDID and create an ad hoc preview build.
- [ ] Install the preview APK on at least one Android device.

## Before public release

- [ ] Complete account deletion, data export, and retention controls.
- [ ] Add rate limits, quotas, monitoring, and incident response for Edge Functions.
- [ ] Review dependencies, licenses, and server routes; remove unused integrations.
- [ ] Complete accessibility, larger-text, reduced-motion, and light-theme support.
- [ ] Review privacy/terms with qualified counsel for launch jurisdictions.
- [ ] Complete native iOS and Android acceptance, accessibility, and offline tests.
- [ ] Review Apple and Google store policies, screenshots, privacy declarations, and age/content ratings.
- [ ] Verify app signing, backup/recovery for managed signing credentials, and release versioning.
- [ ] Do not describe the app as production-ready until all blockers above are resolved.
