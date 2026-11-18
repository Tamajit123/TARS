# TARS implementation and evidence — 4 November 2026

This continues the existing application and project, following the latest owner's implementation authorization. The owner again explicitly chose **Keep Gemini**. No OpenAI billing, provider substitution, new Supabase project or connection replacement was performed.

## Implemented in this pass

- **Recents:** one chronological collection, exact heading, all legacy conversations retained under their existing IDs, search, current selection, creation lock, actual titles and a working deletion-confirmation UI. No Main Chat/Side Chat category remains in application navigation. The legacy database column is retained for compatibility, with existing rows migrated to ordinary conversations.
- **Titles/order:** first meaningful user query supplies the title; follow-ups no longer overwrite it. Recents uses actual latest message time through an owner-scoped, invoker-rights RPC, rather than administrative title-edit timestamps.
- **Feed:** a dedicated validated activity projection on existing request records, grouped once per request, plus root scheduled-task outcomes. Original query, actual response summary, sources, time, status and conversation action are persisted. Raw tool arguments/log strings are excluded. Failures before any provider call are honestly attributed to TARS. Invalid/debug execution rows remain in the audit history, not the user-facing Feed; none were wholesale deleted.
- **Chat isolation:** route/account keys isolate pending replies, uploads and drafts. Delayed initial session events cannot replace a newer identity. Obsolete loads cannot overwrite the current conversation. Same-account token refresh preserves the current screen.
- **Startup:** per-user last tab and conversation are stored separately. Unknown destinations and missing/foreign/unavailable conversations fall back to clean Chat; pending/failed generation removes the automatic-restore pointer without deleting history. A clean view creates its conversation only when needed.
- **Gemini/SSE:** real streaming remains active, with human-readable actual tool activity, correct activity tracking during parallel reads, safe Retry/Stop and saved replies. Added first-text/total timing metadata and actual provider duration measurements. Narrow independent account reads run in batches of at most three; discovery/browser/write preparation retains order.
- **Native service results:** fixed validated Gmail, Reddit, Slack, Jira, Trello, Notion, Calendar, profile/label/list views. Only actual returned fields are rendered; absent fields and empty lists remain honest. Provider/source URLs are filtered. No arbitrary model-generated JSX/HTML/expressions execute. Some exact item links require the provider to return a usable original URL; they are not fabricated.
- **Voice/media repairs:** rejected attachments keep their text/photo/audio preview; recorder start has a synchronous lock; interruption/pause/resume failures are handled. Recording waveform uses actual incoming metering samples, Reanimated scale transforms and Reduce Motion. No synthetic oscillation or automatic recording. Microphone remains beside Send; plus remains left.
- **iOS microphone defect:** native introspection found the Image Picker `microphonePermission: false` removed the description needed by Audio. Both plugins now use the same explicit microphone rationale. Native generated microphone/camera/photo/location descriptions now PASS. Profile selection uses the system photo picker without a broad library-permission prompt.
- **Reminder snooze:** one SQL transaction creates the replacement and updates the original. Parent revision makes retries return the same child. Recurring originals stay active. Ownership is enforced with invoker rights and a composite owner FK. Cloud save and real OS notification status remain distinct.
- **Direct Maps implementation:** server-only Routes/Places requests, bounded field masks/timeouts, explicit missing-key/billing errors, actual alternative durations/distances/geometry, safe directions links and native Google Map rendering. The Expo-compatible renderer is installed. Native map and live API acceptance remain BLOCKED on configuration; no live route is claimed.

## Database changes and preservation

Existing project: `bdswodobwesadjedzhfg`. Before changing it, inspected live tables/columns/relationships/indexes/policies/triggers/grants/buckets/migrations/cron, verified the app URL and linked project match the saved connection, and captured `recents-feed-20261104-before.json` under the ignored audit directory.

Applied through linked Supabase CLI and verified by schema/history readback:

1. `20261103193856_recents_feed_activity.sql` — derived activity, limited-column owner-only Feed reads, first-query titles, legacy category migration, ordinary scheduled-result conversations.
2. `20261103195028_recents_activity_order.sql` — actual message activity ordering and the narrow server-only private-schema usage grant required by activity triggers.
3. `20261103202127_activity_failures_and_atomic_snooze.sql` — pre-tool failures and atomic/idempotent snoozing.

All 14 existing public tables remain with RLS enabled; two buckets remain private; the existing dispatcher remains. No table, conversation, message, execution, connected account or user data collection was dropped/recreated/wiped.

Before new UI-write tests, all 14 table row counts matched: 35 messages, 3 conversations, 40 executions, 20 requests, 11 connection records, one attachment, zero reminders. Fingerprints excluding the intended derived activity fields matched for **13 tables**, including complete message contents, connections, attachments, tasks and profiles. **The conversation fingerprint is FAIL:** the existing update trigger changed `updated_at` during the requested category/title migration. The original baseline was retained; this difference was not waived or relabelled PASS. The ordering RPC fixes the user-visible consequence by using real message activity.

Initial Feed audit: 18 of 40 execution summaries contained technical Composio log text. After projection/backfill, those raw summaries no longer render. Before the later pre-tool-failure migration, the projection contained nine completed and one cancelled request entry, rather than a separate row per internal tool call. Final counts are recorded with final verification.

## Actual evidence already observed

| Check | Status | Evidence / limit |
|---|---|---|
| Google session / history | PASS | Owner signed in; actual Chrome chat visible; hard reload retained session and attachment history |
| Fresh Gemini reply | PASS | Natural three-sentence reply streamed and completed with Copy/Revise; no 503 in that test |
| Reddit / X / Trello / Jira | PASS for tested reads | Four fresh real reads, four completed cards, final actual summary; DB request `mw10f7gc_wj0l1wkvxb` |
| Expanded Jira execution | PASS | Verified account/result milestones and actual zero-record result |
| Browserbase extraction/live viewer | PASS on web | Fresh real Example Domain read, mobile remote page visible, Done returned to chat; request `mw10gkst_e5ai7jorj7h` |
| Private text upload / Gemini reading | PASS | UI Long text upload; exact synthetic `LANTERN-482` code and Tuesday task returned; request `mw10izu9_10gta3a5oddi` |
| Cleaned Feed UI | PASS | Actual source labels/query/summary/status; four-tool request grouped once; Open conversation reopened its saved thread |
| Recents UI | PASS for loaded list | Exact heading, actual first-query title, no Main Chat section |
| Dual-stack development bundle | PASS after restart | IPv4 and IPv6 HTML/bundle checks returned 200; fresh Chrome reload cleared unknown-module overlay |
| New Feed/title/snooze database cases | PASS | Real SQL rollback tests; original and recurring snooze, retry idempotence, stale revisions, ownership, failure/cancellation and debug filtering |
| Existing database regression | PASS | Profile/chat/task/history/lease/idempotence/RLS/storage checks, fixtures rolled back |
| Unit/contract suite | PASS | Final previous-pass run: 78/78 tests; no test was skipped |
| App/Edge TS and lint | PASS | Final previous-pass run passed; app TS and lint also rerun after the localhost launcher change |
| Native configuration | PASS | Actual generated microphone/camera/photo/location descriptions; 120Hz setting present; no background recording/location modes |
| Direct Maps live request | BLOCKED | No `GOOGLE_MAPS_API_KEY`; owner explicitly requested leaving Maps blocked |
| Native Maps rendering | BLOCKED | Platform SDK keys not configured; installed device build required |
| Phone recording/permissions/notification delivery/release motion | BLOCKED | No physical installed-device session available; Chrome/unit/config checks are not substitutes |

The four-provider UI evidence predates the service-preview/parallel-routing deployment. Its fresh AI-driven regression is **BLOCKED by Gemini quota**, not counted as passed on the newer deployment.

## Latest continuation checkpoint — 4 November

- **PASS:** current web, iOS and Android production exports in `.database-audit/tars-release-20261104`; native Hermes bundles were produced. This is JavaScript export validation, not a signed device build.
- **PASS:** artifact scan of 24 HTML/JSON/JavaScript/map/Hermes files, three known local server credential values, zero matches. This bounded scan is not proof against every possible unknown secret.
- **PASS:** final `chat` and `agent-run` deployment to the same project returned success. No keys/configs/connections were recreated.
- **PASS:** a new conversation was created in the real UI, received two context-aware Gemini replies with the exact synthetic `CEDAR-931` code, retained its first-query title, and appeared once in Recents under its exact ID `3281fff1-6cfd-4272-b303-0ef9e8d1a4fe`.
- **PASS:** real Files picker accepted synthetic PNG, WAV and DOCX; uploads completed and all three message links survived a hard reload. **BLOCKED:** their AI interpretation/transcription, because Gemini returned HTTP 429 before generation.
- **BLOCKED, owner accepted:** the subsequent integration turn, one manual retry, the media turn and an independent tiny Gemini health request returned `provider_rate_limited`; health diagnostic was HTTP 429 `RESOURCE_EXHAUSTED`, two transport attempts. No further generation probes are being made. Earlier successful replies are not represented as current unlimited availability.
- **PASS:** independent Browserbase health check returned a real Example Domain read, genuine browser milestones and HTTP 200 for the live viewer; Composio project metadata returned HTTP 200 and 11 auth configs.
- **Fixed:** attachment draft strip could squeeze filenames beneath thumbnails. It now reserves adequate strip height and prevents controls/text from shrinking.
- **Fixed:** a Metro process started within the restricted sandbox listened on 8081 but both loopback connections timed out. Restarting the verified D:\\TARS process outside that sandbox restored reachability.
- **Fixed:** development static rendering subsequently failed with `Requiring unknown module "846"` on repeat HTML requests. The new `scripts/start-expo.cjs` launcher selects Expo's supported SPA output only for development via `TARS_DEV_WEB_SPA=1`; production static output and native config remain unchanged. Use `npm start -- --clear --port 8081` (or `npm run web`).
- **PASS:** after that fix, both IPv4 and IPv6 returned 200 for status, fresh chat HTML, the compiled bundle and eight repeated route requests each, including Feed, Ideas, Tasks, Settings, Tools, auth callback and repeated Chat. Chrome hard refresh retained the signed-in owner, dark theme and exact saved conversation; Feed also refreshed successfully.
- **PASS:** refreshed Feed displayed each quota failure once with TARS source and FAILED status; the earlier real browser result remained COMPLETED; the four-provider query remained one grouped result with actual zero-board/zero-issue results. Open conversation reopened the existing conversation.
- **BLOCKED:** the separate read-only SQL checkpoint timed out on its final attempts. The earlier checkpoint's first failure was a test-script bucket-name mistake (`chat-attachments` versus the actual `tars-chat`), corrected before retry. No deletion or repair was attempted from that assertion. UI upload/link evidence above is separate from an uncompleted database checkpoint.

Expo documents [`web.output` modes](https://docs.expo.dev/versions/latest/config/app/) and [SPA hosting fallback](https://docs.expo.dev/guides/publishing-websites/). The development workaround does not alter production hosting mode.

## Dependencies, configuration and setup

Added only `react-native-maps` **1.29.11**, matching the installed Expo 58 compatibility map. Its actual licence is MIT, copyright 2015 Airbnb; retain the dependency licence on distribution. No Next/Vue/proxy dependencies or third-party application code were copied. The four reference checkouts remain excluded from production and app test discovery. Existing Audio, Document Picker, File System, Location, Notifications, Reanimated, Gesture Handler, Blur, Haptics and Symbols remain.

`app.config.js` preserves the existing app identity and Expo project. It reads only separate platform-restricted Maps SDK build keys and exposes configuration booleans to JavaScript. It never reads the server `GOOGLE_MAPS_API_KEY`. New native modules/plugins require a rebuilt app.

Deferred Maps setup (owner requested keeping Maps blocked; no setup required for this UI pass):

- Google Cloud → APIs & Services: enable **Routes API**, **Places API (New)** and billing; create an API-restricted server key; save it in the existing Supabase project → Edge Functions → Secrets as `GOOGLE_MAPS_API_KEY`.
- For native Google Map previews, enable **Maps SDK for iOS** and **Maps SDK for Android**. Configure separate restricted build environment variables `GOOGLE_MAPS_IOS_SDK_KEY` and `GOOGLE_MAPS_ANDROID_SDK_KEY`. Restrict iOS to bundle `app.tarsai.mobile`, Android to package `app.tarsai.mobile` plus the actual build signing SHA-1, and each key to its platform SDK. Do not reuse the server key.
- Build/install current iPhone and Android variants, then test permissions, denied permission/settings return, recording interruptions/playback, mixed uploads, one-shot/repeating/edit/cancel/snooze/app-closed notifications, map geometry and native motion. Ordinary notification sound does not guarantee Silent/Focus bypass.

API references consulted: Google [Routes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes), [Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search), [Maps URLs](https://developers.google.com/maps/documentation/urls/guide), [attribution](https://developers.google.com/maps/documentation/places/web-service/policies). Routes/Places retention and attribution must be included in release acceptance; API credentials being present is not proof of a correct live route.

## Resumed UI verification — 4 November

The owner continues to request leaving Gemini quota and Maps blocked. No new generation or routing calls are required for these checks.

| Actual UI check | Status | Observed result |
|---|---|---|
| Expired Browserbase preview refresh | PASS | Open Fresh Browser started a new real Example Domain session. The mobile page was visible inside TARS, marked Live preview. Done returned to the same conversation and execution card. No Gemini call was made. |
| Browser preview expiry | PASS | An expired session displayed Ended and preserved the saved conversation/result. |
| Mixed attachment draft layout | PASS | PNG thumbnail, WAV playback control, DOCX filename, sizes and Remove controls were visible above the composer without clipping. Files were synthetic fixtures; this preview check did not submit them again. |
| Audio preview playback | PARTIAL — further check pending | Play changed to Pause and displayed an 11-second duration. Chrome switched tabs before playback progression was verified; audible output is not claimed. |
| Voice-message sheet | PASS for entry/cancel only | Microphone beside Send opened Start recording/Cancel. Cancel returned to chat; no permission was requested or recording started. Actual capture remains a device/permission test. |
| Recents reopen | PASS | First-query titles appeared under Recents; selecting the earlier conversation reopened its exact saved history. |
| Saved multimodal reply | PASS for observed saved output | The current saved reply correctly reported COPPER-726, INR 42.00, Thursday 10:00 AM and NEBULA-814 from the synthetic fixtures. This was already in the owner's chat when resumed, not a newly initiated generation test. |
| Saved provider result cards | PASS for observed rendering | X profile, zero Trello boards and zero Jira issues rendered with provider marks; Reddit showed Needs attention / HTTP 429 rather than a false success. No fresh provider retry was initiated. |
| Reminder forms and remaining navigation | NOT TESTED in the interrupted pass | Browser control ended before these checks. Prior database/contract tests remain separately documented above. |

The preceding pass ended when the computer-use helper could not confidently determine Chrome's current URL. Its mandatory stop was respected. UI checks resumed only after the owner's new instruction; unexecuted checks were not labelled PASS.

### Reminder save recovery fix

Inspection found that a successful `saveReminder` followed by a thrown `syncReminders` left the creation form open. Retrying Save could insert a second cloud reminder. `saveAndSyncReminder` now retains the confirmed saved record and returns a device-scheduling warning when sync fails; the form closes and scheduling can be retried with Enable / check this phone. A failed database save still rejects before any notification sync. Web still reports that an installed app is required.

**PASS:** two new regression tests execute the actual service with failing notification and persistence boundaries. They verify one insert after sync failure, no sync after failed persistence, and no web claim of a scheduled alert. These are controlled boundary tests, not proof of physical notification delivery.

**Current source validation:** `npm test` passed **80/80**, `npm run typecheck` passed and `npm run lint` passed after this fix. No database migration or dependency change was needed. The preceding production exports predate this small reminder recovery change; they are not a new signed-device release.

**Current UI access limitation:** the Windows helper saw Chrome on New Tab with no localhost tab in its returned inventory, including after the owner's initial “loaded” reply. No input was sent into that blank tab, because the earlier helper URL-verification failure required a stop. A request for the actual loaded page heading is pending. Audio progression and the reminder form are still unverified in this continuation; the source/unit fix above does not replace those UI checks.

## Remaining verification

Audio playback progression/pause/replay, reminder form validation and footer reachability, and remaining tab/startup restoration checks require a visible, controllable localhost tab. Physical recording/permission/notification delivery and native motion require installed iPhone/Android sessions. Fresh AI-driven provider regression and Stop/Retry generation remain blocked by the owner's Gemini-quota decision. Maps, including the newly supplied OSRM/MapLibre proposal, remains deferred by the owner's latest instruction. No public routing endpoint or paid Maps setup was added in this UI pass.
