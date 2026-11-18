# Feature status

Current status: [16–17 November verification](DELIVERY_2026-11-16.md). The following 26 October list is historical and does not supersede current blockers or device-test limits.

## Implemented and deployed

- Existing Supabase project retained; five tracked migrations applied and read back. Original values preserved; all ten public tables use RLS. See [database evidence](LIVE_DATABASE_REPORT.md).
- Authenticated chat persists user/reply messages with idempotent request IDs, safe retries and server-side recovery. A client cannot supply a replacement assistant reply for recovery.
- Gemini 3.5 Flash serves chat and scheduled generation. Model 3.8 repeatedly returned 503 in live probes; 3.5 passed. There is no silent provider fallback.
- Read-only Browserbase tools are available to Gemini through a bounded function-calling loop with validated arguments, persisted execution history, short-lived sessions and cleanup. Actual model → browser → persisted response was verified.
- One real server cron job dispatches due tasks every minute. Daily/weekly schedules use IANA timezones and server calculation, exclusive leases, atomic message/history completion and bounded failure retries.
- Composio OAuth catalog/connect/status/disconnect handlers use the authenticated deployed agent-run function. Their account lists are scoped to the verified JWT user, and Connected is stored only after provider verification. New links use the current v3.1 Session API.

## Implemented in the app

- Google-only authentication, protected tabs and callback session restoration; preserved native Google configuration.
- Main and side conversations, persistence/retry UI, activity feed and ideas CRUD.
- Profile name/private avatar, agent personalization and assistant preferences; successful cloud writes precede success messages.
- Light/Dark/System appearance with per-user cache and cloud persistence, navigation/status-bar integration, and palettes throughout app screens.
- Task creation/editing, daily/weekly controls, pause/resume, manual execution, removal from future scheduling while retaining history, and latest 50 execution records.
- Chat shows persisted browser execution progress and an owner-visible live session link while a browser run is active.
- Settings and OAuth callbacks share the real connection screen. Core tool linking no longer depends on an Expo Node API server or EXPO_PUBLIC_API_URL.

## Remaining limitations

- **Composio now works:** the existing Platform credential authenticates successfully. GitHub, Gmail and Google Calendar are connected and read through both the SDK and deployed Gemini agent. See [proof and setup](COMPOSIO_SETUP.md).
- The Gemini registry supports GitHub profile, Gmail label and Calendar list reads, plus public browsing. Other provider actions and confirmation for external writes remain unavailable. Saved external-action payloads are rejected; no success is fabricated.
- Replies currently return after completion; token streaming is not implemented.
- Push notifications, pricing/subscriptions, and autonomous external delivery are not implemented.
- Google sign-in, theme appearance, keyboard interactions and avatar upload have not been re-tested on a device in this run. Android/iOS/web bundles pass; this does not establish device UX or OAuth success.
- Five high dependency advisories remain in Expo CLI's transitive node-forge/Zod tree. No breaking Expo downgrade was applied.

The application is **not claimed to have full Muse feature parity**. See [verification details](TEST_REPORT.md) and [reference comparison](REFERENCE_COMPARISON.md).
