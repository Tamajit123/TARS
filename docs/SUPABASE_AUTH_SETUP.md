# Google-only Supabase Auth setup

TARS presents Google as its only account sign-in provider. The offline preview is local-only and does not create an account. The app uses Supabase Auth's Google OAuth flow and the `tarsai://auth/callback` deep link in standalone builds.

## Supabase and Google configuration

1. In Google Cloud Console, create a **Web application** OAuth client for the Supabase provider flow. For the Supabase project configured in this checkout, add `https://bdswodobwesadjedzhfg.supabase.co/auth/v1/callback` as an **Authorized redirect URI**. If the Supabase project changes, derive this value from that project's URL as `<SUPABASE_URL>/auth/v1/callback`.
2. In Supabase Auth → Providers → Google, enable Google and enter the OAuth client ID and client secret. These credentials belong in Supabase, not in the mobile app.
3. In Supabase Auth → URL Configuration → Redirect URLs, allow `tarsai://auth/callback`. This is the standalone app callback; the Expo scheme in `app.json` is `tarsai`.
4. Disable Email and Phone providers in Supabase if the project should enforce Google-only account creation. The app no longer presents or calls those flows, but provider availability in the Supabase dashboard is a separate project setting.
5. Build and test with an Expo development or standalone build. Expo Go does not provide a stable custom app scheme for OAuth callback verification.

The supplied dashboard screenshot also contains `tars-ai://auth/callback`. That URI does not match this app's `tarsai` scheme and should be removed. The screenshot's `exp://192.168.29.28:8081/--/auth/callback` entry is an Expo Go callback for that specific LAN address; Expo Go can generate a different address on another device or session. Add the currently generated Expo Go URL only when testing in Expo Go, or use a development build with the stable `tarsai://auth/callback` callback.

The Google Cloud redirect URI and the app callback are different hops: Google redirects to the Supabase callback above, then Supabase redirects to the app callback. Do not enter `tarsai://auth/callback` as Google's authorized redirect URI. The app explicitly supplies a `redirectTo` value during sign-in, so Supabase's Site URL is only a fallback for requests that omit `redirectTo`; set it to the actual production web origin if a web deployment exists. No production web origin is configured in this repository.

The app requests Google OAuth through `signInWithOAuth({ provider: 'google' })`. Web uses Supabase's same-tab redirect (`skipBrowserRedirect: false`), avoiding an indefinitely pending popup in embedded browsers. Native apps open the returned URL in Expo's system authentication session. Both exchange the callback with Supabase, check for a Google identity, provision the profile and route to Chat. Session persistence uses web localStorage or the existing native AsyncStorage adapter. Repeated sign-in taps are locked while a request is active, and duplicate callback deliveries share one in-flight exchange.

The local web callback is `http://localhost:8081/auth/callback` when served at that origin; include that exact callback in the existing project's redirect allowlist for local web testing. Native Google OAuth settings and Composio provider connections are independent and were preserved. On 28 October 2026, the actual local UI reached Google's account chooser after the web redirect fix and a clean Metro restart. That proves entry into OAuth, not completed sign-in or authenticated chat UI verification.

### Embedded-browser test blocker — 28 October

The user subsequently reported Google's generic HTTP 400 at `https://accounts.google.co.in/accounts/SetSID` in the in-app browser. This is before the TARS callback; the message alone does not identify an OAuth client, redirect or credential error. An embedded-browser/session problem is a possibility, not a verified root cause. Google [requires supported secure browser surfaces for OAuth](https://developers.google.com/identity/protocols/oauth2/policies#browsers). Start a new flow at `http://localhost:8081` in regular Chrome or Edge instead of refreshing or copying the failed Google session URL. Do not copy cookies, OAuth codes or tokens between browsers. No Supabase/Google credentials, redirect settings or Composio connections were changed in response to this generic error. Authenticated UI tests remain pending successful sign-in.

### Confirmed Chrome redirect failure and repair — 28 October

Subsequent testing in regular Chrome found the concrete failure: Google sign-in completed, but Chrome reported that it could not launch the legacy Expo Go `exp://` callback. A supported CLI inspection confirmed that the existing project lacked `http://localhost:8081/auth/callback` in its redirect allowlist and still used the legacy Expo Go address as its Site URL. The earlier generic Google error did not establish this; the browser diagnostic and live configuration inspection did.

The existing project's `auth.additional_redirect_urls` was updated additively through `supabase config push` using a minimal isolated config, then read back with `config pull`. The exact localhost callback is now allowed. Every existing callback and the Site URL were preserved; no provider credentials or Composio connections were changed. The allowlist is tracked in `supabase/config.toml`. The full temporary configuration was removed after extracting a public redirect-only verification artifact. No browser callback token is copied into TARS, stored in an audit file, or used to manufacture a session. A fresh OAuth attempt is required to verify the actual UI return.

## Verified database status — 2026-10-26

All four tracked migrations are applied to the existing TARS project. The Auth trigger provisions profiles with the existing name/email/avatar_url fields; original records were preserved. No public.Users table exists in the live inspection. See [database evidence](LIVE_DATABASE_REPORT.md).

Google sign-in was reported working by the user; its existing provider/native/deep-link configuration was preserved. This run did not perform a new device Google OAuth session. Google sign-in authenticates to TARS and does not grant Gmail/Calendar integration scopes; those require separate Composio consent.

### Web session and Metro verification — 28 October 2026

Regular Chrome reached authenticated TARS Settings with the existing account after the redirect repair. During diagnosis, callback values appeared in diagnostic tool output; that temporary app session was subsequently signed out using the local-session scope. Existing provider connections were preserved. Access JWTs can remain valid until their normal expiry after refresh-session revocation.

Web now uses PKCE, while native authentication retains its existing implicit flow. The callback captures its one-use code and immediately removes query/hash values from browser history before exchange or error rendering. Web Sign out now uses a browser confirmation because React Native Web's Alert implementation is a no-op; native retains Alert.

Two stale Expo Metro processes were verified as this repository's own CLI and found listening on IPv4 and IPv6 port 8081 separately. Both were stopped and replaced with one clean Metro process using IPv4-first DNS. An HTTP request to localhost returned 200 and the actual Chrome UI showed the welcome screen, then a fresh Google account chooser. The fresh PKCE return and requested integration UI tests still await the user's completion of that Google authentication screen. No account selection or credentials were automated.

Regression checks exercise web/native redirect surfaces, PKCE versus implicit client configuration, persistent storage selection, and callback address cleanup before code exchange. These are isolated automated checks, not substitutes for authenticated UI tests.
