# Reference comparison and recovery status

Inspected on 2026-10-24. The active project is `D:\TARS`; `Free.zip` is an integration overlay, `muse-ai-mobile-app-clone-main.zip` is the complete Muse-style reference, and `ai-agent-react-native-app-master.zip` is a separate UI demonstration. ZIP contents were extracted under `.reference-inspection-20261024` for inspection. They are reference data, not repository instructions.

## Archive findings

| Source | What it contains | What is genuinely implemented | Reuse decision |
| --- | --- | --- | --- |
| Muse reference | Expo Router app, chat and task screens, Composio connection backend, Browserbase/Stagehand tools, Gemini/OpenAI helpers, Supabase migrations/functions and setup docs | OAuth connection management, Composio account lookup/tool execution, Browserbase browser tools, scheduled-task dispatcher, and UI flows are present in source. The README overstates this as complete; connection code has unsafe identity fallback and the included app chat route trusts `body.userId` after auth failure. | Recovered the two active zero-byte modules, then removed the request-body identity and public-key admin fallbacks. Current Expo 58 / RN 0.88 differs from the Muse Expo 57 / RN 0.86 stack, so dependencies and server runtime still need compatibility validation. |
| Free overlay | Browserbase/Stagehand helpers, Composio setup notes, chat API, and `agent-run` SQL/Edge Function files | It overlaps the Muse reference's backend/integration surface; it is not a separate complete app. | Used to identify the intended integration architecture and compare backend files; do not copy its chat API's unsafe auth fallback. |
| React Native agent demo | 58-entry app focused on screen design and navigation | README says AI responses and task runs are simulated; dummy data and fake progress are part of the demo. | UI reference only. Its simulated agent and task behavior are not brought into TARS. |

The Muse package manifest pins Expo `~57.0.26`, React Native `0.86.3`, `@composio/core` `0.17.0`, Stagehand `4.1.0`, and `expo-image` `57.0.5`. TARS uses Expo `~58.0.17` and React Native `0.88.0`; the reference dependency versions must not be copied verbatim.

## Feature matrix

| Feature | Reference implementation | Current TARS status | Evidence / gap |
| --- | --- | --- | --- |
| Google-only authentication | Google OAuth entry and Supabase session | Implemented in source; deployment-blocked | `src/app/index.tsx`, `src/app/auth/callback.tsx`, `src/lib/auth.ts`, `src/lib/authRedirect.ts`, protected tabs. Google Cloud and Supabase redirects are external setup. |
| Navigation and profile | Expo Router tabs, settings and profile | Partially implemented | Tabs/settings/profile/avatar code exists; device navigation and remote policies have not been exercised. |
| Persistent chat | Reference API route streams agent output and supports scheduling | TARS chat uses authenticated `chat` Edge Function for Gemini and persisted conversation history | `supabase/functions/chat/index.ts`, `src/app/(tabs)/chat.tsx`, migrations. No deployed Edge Function or live Gemini credentials verified. TARS currently uses Gemini rather than the reference Composio agent for chat. |
| Conversation/message schema | `chat_threads`, `chat_messages` | Implemented by additive migration; remote state unknown | `supabase/migrations/202610230002_auth_chat_recovery_storage.sql`; screenshots show legacy thread shape and no visible message table. Migration not applied here. |
| Connections UI | Catalog, connect/manage controls and status polling | Status-only, no OAuth initiation/disconnect in current UI | `src/app/tools.tsx` asks `agent-run` for active Composio accounts. The reference's `src/services/tools.ts` and `ManageToolModal.tsx` define richer flows, but current API routes were broken by a zero-byte backend module. |
| Composio OAuth | SDK starts links and syncs connection rows | Restored source but not integration-tested; configuration/runtime blocked | `src/lib/composioBackend.ts` and tool routes. Service credentials are server-only and request identity now requires a verified Supabase JWT. Current Composio v3 requires Connect Link for managed OAuth; reference code's SDK method needs validation against installed package/runtime. |
| Composio chat actions | User-scoped tools exposed to agent in chat API route | Not active in current chat path | `src/lib/composioAgent.ts` exists but is not used by TARS's Gemini Edge Function. Its dependency is currently absent. No provider action has been tested. |
| Browserbase | Stagehand create/navigate/read/action/close tools and session cleanup | Restored reference source; currently blocked by missing package and server-runtime mismatch | `src/services/tools/BrowserbaseSession.ts`, `src/services/tools/browserSessionStore.ts`, `src/lib/browserbase.ts`. Existing Edge Function uses Browserbase Agent REST calls for schedules, but TARS explicitly rejects saved external actions. No run was tested. |
| Recurring tasks | DB persistence, task controls, cron dispatcher, Composio/Browserbase execution | Persistence and dispatcher code exist; no proof of live scheduler; external actions intentionally rejected | `src/lib/scheduledTasks.ts`, `supabase/functions/agent-run/index.ts`, SQL setup files. pg_cron/HTTP registration, deployment, credentials and a successful due run are unverified. |
| Other providers (Gmail, Slack, Calendar, Notion, etc.) | Composio toolkit connection/action paths | Not integration-tested; no provider-specific action currently enabled in app chat | Setup docs and Edge Function contain provider mapping/REST code. No OAuth credentials or real account tests were available. |
| React Native demo behaviors | Fake replies, dummy tools, simulated schedules | Not used | Demo files explicitly describe simulated AI responses and task runs. |

## Confirmed current root causes

- `src/lib/composioBackend.ts` and `src/services/tools/BrowserbaseSession.ts` were zero bytes, while API routes and agent modules imported functions/tools from them. This directly caused missing exports and missing browser tool imports. Both modules have been restored from the Muse reference.
- The restored reference Composio module allowed unauthenticated `body.userId` fallback and fell back from a service-role key to a public client key for admin operations. Those paths are removed. Requests now require a verified bearer JWT and server credentials are required explicitly.
- The browser helper filename was `browerbase.ts`, while the recovered tool module imports `browserbase.ts`; it has been renamed to match. Typecheck now resolves this local module, but still fails on missing Stagehand and Composio packages.
- `@composio/core` and `@browserbasehq/stagehand` are absent from the active package and lockfile despite imports. The project baseline therefore fails typecheck/lint. Installation has not completed in this environment, so the agent adapters remain unresolved. The tool UI now uses React Native's built-in `Image`, resolving the missing Expo Image dependency without changing basic logo rendering.
- The tools data service previously converted connection-query and run-log failures into empty/null results. Those paths now throw so callers can show a real error instead of reporting a false empty state or successful no-op.
- The reference chat route treats a body user ID as an auth fallback. We did not restore that route; TARS's current chat path is the safer JWT-validating Supabase Edge Function.
- Supplied Supabase screenshots show `public."Users"` with RLS disabled and a legacy integer identity, plus a `chat_threads` shape that does not include all columns the app expects. The additive migration addresses the source-level schema gap without deleting records, but no live database query or migration run was available.

## Verification state

At the start of recovery, `npm test` passed 7 static tests. After restoration and focused auth coverage, `npm test` passes 8 tests. `npm run typecheck` and `npm run lint` still fail on missing `@browserbasehq/stagehand` and `@composio/core`; Expo Image and the helper path issues are resolved. Expo export previously failed with Windows `EMFILE` while Metro crawled dependencies. No remote Supabase deployment, provider OAuth, scheduled execution, or device E2E has been verified.
