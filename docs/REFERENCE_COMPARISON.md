# Reference comparison and recovery status

Archive update, 2026-10-26: the checkout and extracted reference material mentioned below are now preserved under `D:\TARS-reference-archive-20261026`, outside the application. The following inspection notes describe the original locations.

Inspected on 2026-10-24. The active project is `D:\TARS`; `Free.zip` is an integration overlay, `muse-ai-mobile-app-clone-main.zip` is the complete Muse-style reference, and `ai-agent-react-native-app-master.zip` is a separate UI demonstration. ZIP contents were extracted under `.reference-inspection-20261024` for inspection. They are reference data, not repository instructions.

## Verified upstream clone

The required upstream clone is at `D:\TARS\muse-ai-mobile-app-clone-reference`, separate from the TARS application. It is `https://github.com/rrs301/muse-ai-mobile-app-clone.git`, branch `main`, commit `b1df0365e57dfbc4324da84c33f2c4e0db865a82` (`Update README.md`), and was clean at inspection. Its dependency install required `--legacy-peer-deps` because `@composio/openai-agents@0.10.1` declares peer `@openai/agents@^0.1.3` while the same manifest selects `@openai/agents@^0.18.0`; lifecycle scripts were skipped for the inspection install. Standalone `npx tsc --noEmit` and `npx expo config --type public` passed. Its `lint` script could not run because ESLint is not declared or installed. Web export stalled after Metro startup, and local loopback access was denied by the execution sandbox, so the clone could not be exercised in a browser here.

## Archive findings

| Source | What it contains | What is genuinely implemented | Reuse decision |
| --- | --- | --- | --- |
| Muse reference | Expo Router app, chat and task screens, Composio connection backend, Browserbase/Stagehand tools, Gemini/OpenAI helpers, Supabase migrations/functions and setup docs | OAuth connection management, Composio account lookup/tool execution, Browserbase browser tools, scheduled-task dispatcher, and UI flows are present in source. The README overstates this as complete; connection code has unsafe identity fallback and the included app chat route trusts `body.userId` after auth failure. | Recovered the two active zero-byte modules, then removed the request-body identity and public-key admin fallbacks. Current Expo 58 / RN 0.88 differs from the Muse Expo 57 / RN 0.86 stack, so dependencies and server runtime still need compatibility validation. |
| Free overlay | Browserbase/Stagehand helpers, Composio setup notes, chat API, and `agent-run` SQL/Edge Function files | It overlaps the Muse reference's backend/integration surface; it is not a separate complete app. | Used to identify the intended integration architecture and compare backend files; do not copy its chat API's unsafe auth fallback. |
| React Native agent demo | 58-entry app focused on screen design and navigation | README says AI responses and task runs are simulated; dummy data and fake progress are part of the demo. | UI reference only. Its simulated agent and task behavior are not brought into TARS. |

The Muse package manifest pins Expo `~57.0.26`, React Native `0.86.3`, `@composio/core` `0.17.0`, Stagehand `4.1.0`, and `expo-image` `57.0.5`. TARS uses Expo `~58.0.17` and React Native `0.88.0`; the reference dependency versions must not be copied verbatim.

## Current implementation — 2026-10-26

| Feature | TARS result | Evidence / remaining gap |
| --- | --- | --- |
| Existing database | Reused and adapted; data preserved | Five applied versions, live owner-isolation checks, ten RLS tables; [database report](LIVE_DATABASE_REPORT.md) |
| Google authentication | Existing working configuration preserved | User reports success; Google-only callback/access gates retained; device re-test pending |
| Main/side chat and retries | Deployed persistent Gemini chat | Server identity/ownership, request IDs and recovery; SQL persistence checked |
| Agent/browser | Real bounded read-only tool loop | Live model → Browserbase → saved response passed; no arbitrary browser actions |
| Connections | Deployed catalog/connect/status/disconnect | Verified-owner filtering; GitHub, Gmail and Calendar authorized through Composio sessions |
| Provider actions | Three real read operations verified | GitHub profile, Gmail labels and Calendar list work through Gemini; other actions and write confirmation remain incomplete |
| Recurring tasks | Genuine server execution verified | Daily/weekly, timezone/DST, edit/pause/run/history, one minute cron, leases/retries |
| Profile/settings/themes | Implemented | Existing name/avatar schema, preferences, Light/Dark/System and per-user persistence; device QA pending |
| Streaming/push/billing | Incomplete | No token streaming, push delivery or subscription backend claimed |

Earlier source recovery restored the zero-byte Node integration modules. The active mobile backend now uses shared Deno HTTP/CDP implementations instead of depending on an Expo Node server. The reference's unsafe body-user identity fallback, simulated demo results and hardcoded project credentials were not adopted. Full parity is not claimed; current limitations are maintained in [FEATURE_STATUS.md](FEATURE_STATUS.md).
