# Feature status — October 24, 2026

## Implemented in source

- Expo Router shell with Chat, Activity, Ideas, Tasks, and Settings destinations; offline preview remains device-local.
- Google-only sign-in UI using Supabase OAuth, persisted sessions, Google-identity verification, duplicate-tap protection, and a protected tabs layout. The offline preview remains a local-only option and is not an account method.
- Display-name editing and private avatar upload through a signed-URL flow.
- Chat Edge Function verifies the bearer session, confirms conversation ownership, persists user and assistant messages on the server, and uses request IDs to make retries idempotent.
- Gemini is the chat provider; its key is read only by the `chat` Edge Function. There is no silent model fallback.
- The Connections screen queries the authenticated `agent-run` function for real Composio account status. Connect/disconnect OAuth flows remain unavailable.
- The task runner rejects client-selected external actions and saved schedules containing Browserbase/Composio payloads. Its existing chat-only scheduled AI behavior remains subject to deployment and provider configuration.
- Additive Supabase migration repairs the visible legacy chat schema, installs owner policies, creates request recovery records and a private avatar bucket, and locks down the legacy `public."Users"` table without deleting its rows.
- Security tests cover RLS ownership, service-side credentials, chat ownership/idempotency, and migration safeguards.

## Confirmed by local checks

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 7 passed, including Google-only authentication and protected-route checks.
- `npx expo config --type public` — passed; reports scheme `tarsai` and Expo SDK 58.
- `npx expo export --platform all --max-workers 1` — blocked by Windows `EMFILE` (too many open files) while Metro crawled the icon dependency.

These are source-level checks. They do not verify a deployed Edge Function, the remote database, Google OAuth provider configuration, or a physical device.

## Supabase schema evidence from the supplied screenshots

- `public."Users"` is marked RLS disabled and has a bigint ID plus a numeric token field. This is not a safe substitute for Supabase Auth's UUID identity. The migration preserves every row and denies Data API access until an explicit, verified mapping is designed.
- The visible `chat_threads` table has UUID `id` and `user_id`, plus `title`, `created_at`, and `updated_at`; the app also needs `type` and `has_unread_updates`.
- `chat_messages` is not among the visible tables. App history writes and the chat Edge Function require it.
- The screenshot shows four policies on `chat_threads`, but not their expressions. The migration adds a restrictive owner guard so existing permissive policies cannot bypass ownership.

This evidence explains the observed chat errors. It is not a live database inspection; the screenshots do not show every schema object or policy expression.

## External setup still required

- Review and apply `supabase/migrations/202610230002_auth_chat_recovery_storage.sql` to the intended Supabase project, then deploy the `chat` and `agent-run` functions and set server secrets. No remote change was made from this workspace.
- Configure Google OAuth in Google Cloud and Supabase, allow the `tarsai://auth/callback` redirect, and disable Email/Phone providers in Supabase if Google-only account creation is required. See [Google-only Auth setup](SUPABASE_AUTH_SETUP.md).
- Set `GEMINI_API_KEY` as a Supabase Edge Function secret. See [AI provider setup](AI_PROVIDER_SETUP.md).
- Configure Composio server credentials if live connection status is needed. Status lookup does not enable external actions.
- Run signed-in service checks on the target project and Expo Go/device checks after deployment.

## Not implemented or not yet verified

- Account deletion/export and persisted Light/System theme selection.
- Chat streaming, search/rename/export, push notifications, billing, and native production OAuth connector flows.
- Real Supabase migration execution, deployed function verification, Google OAuth provider callback verification on a device, and device end-to-end testing.
