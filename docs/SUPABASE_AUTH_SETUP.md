# Google-only Supabase Auth setup

TARS presents Google as its only account sign-in provider. The offline preview is local-only and does not create an account. The app uses Supabase Auth's Google OAuth flow and the `tarsai://auth/callback` deep link in standalone builds.

## Supabase and Google configuration

1. In Google Cloud Console, create a **Web application** OAuth client for the Supabase provider flow. Add the Supabase callback URL shown in the Supabase Google provider settings as an authorized redirect URI.
2. In Supabase Auth → Providers → Google, enable Google and enter the OAuth client ID and client secret. These credentials belong in Supabase, not in the mobile app.
3. In Supabase Auth URL Configuration, add `tarsai://auth/callback` to the redirect URL allow-list. The app's Expo scheme is `tarsai`.
4. Disable Email and Phone providers in Supabase if the project should enforce Google-only account creation. The app no longer presents or calls those flows, but provider availability in the Supabase dashboard is a separate project setting.
5. Build and test with an Expo development or standalone build. Expo Go does not provide a stable custom app scheme for OAuth callback verification.

The app requests Google OAuth through `signInWithOAuth({ provider: 'google' })`, opens the returned URL in the system auth session, exchanges the callback with Supabase, checks for a Google identity, provisions the profile, and routes to Chat. Session persistence uses the existing React Native AsyncStorage adapter. Repeated sign-in taps are locked while the browser session is active, and duplicate deliveries of the same callback share one in-flight exchange.

## Profile and migration

Apply the reviewed additive migrations before using cloud profiles. The trigger creates `profiles` rows keyed by `auth.users.id`; the legacy `public."Users"` table remains intact and denied Data API access pending a verified mapping plan. No existing user data is deleted.

## Known limits

Google provider credentials, redirect allow-list configuration, migration application, and callback behavior have not been verified against the live Supabase project or a device. Google sign-in authenticates to TARS; it does not grant Gmail or Calendar API scopes. Those require separate consent and provider integrations.

See [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) for current setup details.
