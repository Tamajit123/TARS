# TARS stabilisation and feature inventory — 3 November 2026

The user confirmed Gemini remains active. References to OpenAI in the supplied specification apply to the selected Gemini engine instead. No OpenAI billing or provider switch is authorised by that template.

## Baseline inventory (before this audit's application changes)

| Area | Existing implementation | Verification needed |
|---|---|---|
| Runtime | Expo 58.0.17, React Native 0.88.0, React 19.3, Expo Router 58.0.25, strict TypeScript 6 | Native installed builds |
| Screens | Google sign-in, callback, Chat, Feed, Ideas, Tasks, Settings, Tools & Connections, privacy, terms; sidebar and agent/profile editors | Current UI walkthrough |
| State | Screen React state; user-scoped AsyncStorage; theme, motion and toast contexts; Supabase persistence | Restart and expired-session scenarios |
| Authentication | Google-only Supabase OAuth; web PKCE, native browser callback; protected tabs | Sign-in/logout require interactive session |
| Data | Existing project bdswodobwesadjedzhfg; profiles, threads/messages, ideas, schedules, executions, connection mapping, pending confirmations | Fresh preservation baseline and transactional RLS checks |
| AI | Server-only Gemini REST/SSE, Stop, safe retry, Copy, Revise, Markdown/code/tables, persistent requests | Live conversational/tool responses; dedicated regenerate is absent |
| Composio | Installed core 0.17 range, server integration, stable Supabase user ID, reusable session, ten configured providers, new links per attempt, ACTIVE validation | Current account statuses and real reads, not config counts |
| Browserbase | Server mobile viewport 390×844, public page extraction, real execution cards, short-lived read-only preview and owned preview refresh | Preview refresh and actual mobile live-view rendering |
| Cloud tasks | Daily/weekly timezone-aware pg_cron dispatcher, leases, history, edit/pause/manual run | Fresh live cron execution; notifications are separate |
| Device alerts | Expo Notifications, OS-scheduled one-shot timers/next-time or daily audible reminders, local user-scoped records | Physical iPhone/Android permission, delivery and sound tests |
| Profile | Profile edits, private avatar upload and signed preview; settings persisted | Current interactive save/photo round trip |
| Appearance | Semantic light/dark/system themes, native iOS tabs/SF symbols, safe-area wrappers, reduced-motion-aware press/sheet feedback | Physical keyboard, Dynamic Type, VoiceOver and release motion |
| Storage | Private avatar bucket only in inspected source | Live bucket inventory before any additions |
| Voice/attachments | No chat recording/upload pipeline, document picker or attachment schema yet | New implementation after stabilisation gate |
| Maps | Not in existing catalog or agent tools | Official toolkit exists; live eligibility/auth requirements still need verification |

## Current test evidence

| Check | Initial status | Finding/fix | Latest status |
|---|---|---|---|
| Automated regression | PASS | 64 tests, including real provider boundary simulations, ownership and notification failure paths | PASS |
| Application and Edge TypeScript | PASS | Both checks completed | PASS |
| Lint | PASS | Completed | PASS |
| Live Gemini inference | Previously BLOCKED (503) | Current configured model returned a real response on 3 November | PASS (backend probe only) |
| Live Browserbase extraction | NOT TESTED this audit | Example Domain retrieved; three actual milestones; viewer endpoint HTTP 200 | PASS (backend probe only) |
| Database preservation script | FAIL | Historical snapshot expects 20 executions; current table has 33 after prior authorised tests/use. This is not proof of data loss. Preserve old snapshot and capture a separate current baseline. | Pending fresh check |
| Android build | NOT TESTED | Latest EAS result is an old 25 October production build. Prior preview attempt did not enqueue a newer build. | NOT TESTED for current source |
| Current UI, OAuth, physical phone features | NOT TESTED | No device/UI result inferred from unit tests or backend probes | NOT TESTED |

## Gate and acceptance

Audit and repair existing workflows before voice, mixed attachments, enhanced reminders or Maps. Record every critical blocker explicitly before proceeding. Preserve all existing data, connections, project identities and working features. Do not call a source implementation a physical-device PASS.

Normal notification sounds cannot guarantee delivery through Silent Mode or Focus. Current device alerts are reminder notifications, not AlarmKit or Critical Alerts. No entitlement or real phone ringing has been verified.

## Live follow-up

- Existing Chrome Google session restored after restarting the confirmed hung TARS Expo process on port 8081. Normal zoom and saved Dark appearance visually verified.
- Browser chat composer and bottom tabs do not overlap at the tested window size. Native keyboard and safe areas remain NOT TESTED on physical devices.
- Fresh Browserbase button from an owned saved execution opened a real mobile page in TARS. Actual page visible in live viewer; Done returned to chat. PASS for web live-view round trip.
- Full chat plus real cron Gemini inference returned HTTP 503 UNAVAILABLE after three transport attempts. The simple probe had passed earlier. BLOCKED by intermittent upstream availability; no substitute responses or provider switch.
- Fixed a SQL string quoting syntax error in the live-scheduler diagnostic. Actual pg_cron dispatched its tagged test, reported the provider failure, and its fixtures were removed.
- Transactional profile, idea, chat, schedule, execution-history and confirmation permission/isolation checks PASS. Historical fingerprint check remains FAIL for changed execution rows; permissions-only output explicitly does not assert preservation.
- Physical audio, permissions, notifications, camera, haptics and release-frame performance are BLOCKED on access to installed device builds. OAuth consent/reconnection remains user-operated; working connections are preserved.

Remaining stabilisation work: test task controls and connection statuses, fix confirmed UI failures, then proceed to new feature implementation with the above external/device blockers recorded.

## Implementation and verification update

- **Gemini:** active model is now `gemini-3.6-flash`, using the existing remote key. The 3.1 model returned 503, and 3.5 intermittently timed out. Full-agent 3.6 streaming probe PASS. Real pg_cron → deployed agent-run → Gemini → PostgreSQL PASS; result saved exactly once, next occurrence persisted, lease released, tagged fixtures removed. Current interactive reply verification remains pending.
- **Tasks bug fixed:** alarm, reminder and agent sections were nested inside the New task button. Sections now render independently. Web Run/Remove use real confirmation modals. Weekly schedule copy reflects the selected weekday.
- **Voice:** Expo Audio recording starts only on explicit Start; microphone permission, denied-settings action, duration, pause/resume, real metering animation, interruption pause, stop/cancel, preview and private upload/playback. Mic is beside Send; plus remains left. Reduce Motion supported. Physical iPhone/Android recording, interruption and audio playback NOT TESTED.
- **Attachments:** private `tars-chat` bucket; owner/thread-bound immutable metadata; upload progress/cancel/retry/readback; mixed files; image thumbnails; original file references in messages; signed retrieval. Images/PDF/audio use actual Gemini inline parts. UTF-8 text/CSV/JSON and bounded DOCX/XLSX/PPTX text extraction supported. Macros/formulas/external XML entities never execute. Legacy DOC/XLS/PPT originals can be retained, but analysis explicitly requests PDF/CSV/TXT export. Text above the supported limit is rejected without silent truncation. End-to-end upload/AI/playback UI verification pending.
- **Reminders:** account persistence plus per-device OS notification identifiers, once/daily/weekly, edit, complete, remove, snooze, restart reconciliation, tap-to-Tasks routing, permission/status UI and sound control. Repeats follow each phone's local wall clock/DST; one-shot timestamps are absolute. Chat creates a review card; confirmation saves cloud data, then the app verifies OS scheduling separately. No Silent/Focus bypass or continuous alarm claim. Physical notification delivery NOT TESTED.
- **Maps:** live Composio metadata verified `google_maps` and `GOOGLE_MAPS_GET_ROUTE`; managed OAuth configuration created only for this new provider (`ac_jI18SDprXKgL`). Existing ten configs/connections preserved. Runtime schema discovery and reviewed route/place tools added. Structured route card uses only actual returned distances/durations, with exact official Google Maps directions URL. No fake route geometry. Explicit one-shot foreground location sharing adds coordinates to the draft for review; manual origins supported. OAuth consent and real route execution remain BLOCKED on user authorisation.
- **Schema:** additive migration `20261103150455_chat_media_and_task_reminders` applied via linked Supabase CLI and verified by readback. New tables: `chat_attachments`, `task_reminders`, `reminder_notifications`; all RLS enabled. Private bucket `tars-chat`. Generated TypeScript contracts match the live schema. Existing tables/data were not dropped or recreated.
- **Dependencies:** Expo-compatible audio, document picker, file system, date/time picker and location; patched pinned fflate 0.8.3 is server/test-only. Existing native notification dependency retained. Native permission/plugin introspection PASS; no background recording or location enabled.
- **Checks:** 69 automated tests PASS; app and Edge TypeScript PASS at the last completed check; production web/iOS/Android export PASS before the last settings refinements. Client artifact scan: 22 files, 3 known server credentials checked, zero matches. New table/bucket ownership and anonymous-denial checks PASS in a rolled-back transaction. Full final UI/device acceptance is not inferred from these checks.

## Device/build acceptance still required

Rebuild the native app for new audio/location/date-picker plugins, bundled alarm sound and exact-alarm permissions. Test both phones: permission denial and Settings return; actual recording and interruption; upload failure/retry; signed playback after restart; 6-second timer with app closed; one-time/daily/weekly reminder, edit/cancel/snooze and notification tap. Expo web cannot verify closed-app phone ringing.

Keep the existing Supabase public URL/key in the build environment. Server-only Gemini/Composio/Browserbase credentials stay in Edge Function secrets. No new Maps API key is needed for the selected managed-auth path unless the real provider reports an additional billing/API configuration requirement.
