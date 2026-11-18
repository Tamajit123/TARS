# TARS release verification — 18 November 2026

This is a preview candidate, not a claim that every category or native device behavior is certified. The final user instruction prioritizes completing verification, pushing the current work and preparing deployment without further scope expansion.

## Actual current checks

| Area | Result and evidence |
| --- | --- |
| Automated regression | PASS: `npm test`, 111 tests, zero failures |
| App and Edge TypeScript | PASS: `npm run typecheck`, `npm run typecheck:edge` |
| ESLint | PASS: `npm run lint` |
| Production JS/static exports | PASS: Android 2,208 modules, iOS 2,184 modules, web 1,727 modules, 20 static routes; this is not a signed native binary |
| Exported client credential scan | PASS: 26 files, 3 known server credential values checked, zero matches |
| Existing Supabase | PASS: linked/runtime/saved connection agree; 14 RLS tables, two private buckets, existing cron retained |
| Data preservation | PASS: original conversation-message column fingerprints match the pre-upgrade baseline; no history wipe or table drop |
| Ownership/security/storage/scheduler | PASS: final permissions-only rollback run, including cross-owner denial, private attachment ownership, scheduling leases and timezone/DST rules |
| New migrations | PASS: both additive migrations applied and read back; research RPC denies anon/authenticated and enforces owner concurrency |
| Mobile composer | PASS in browser at 390 × 450: six-line sequential typing retained focus; 112 px bounded draft with 160 px scroll content; Send/Voice remained visible. Real phone keyboard remains untested. |
| Browserbase Search/Fetch | PASS actual backend: Search 1,679 ms / 6 sources; Fetch 756 ms / example.com |
| Mobile Browserbase live view | PASS actual TARS UI: fresh preview opened, live remote page visibly rendered at 390 × 844; expired preview showed Ended honestly. Screenshot retained locally. |
| Gemini natural text | PASS actual UI: programming explanation with real streamed text, Markdown and code; 7,698 ms total / 6,227 ms first text |
| Gemini after tools | PASS actual persisted research, flight-source, subscription and connected Gmail replies. Transient 503 and 429 failures also occurred and are not counted as successful calls. |
| Image + document + audio | PASS actual UI/private upload/Gemini analysis: image COPPER-726 / INR 42.00; document NEBULA-814 / Monday; audio ORBIT-529 / Wednesday / 11:30 AM, all matched synthetic ground truth |
| Audio playback | PASS actual UI: Play changed to Pause with 9-second duration, then completed to Play at 9/9 seconds |
| Voice recording on devices | NOT TESTED in this final pass; native microphone permissions/interruption/background behavior require a real device build |
| GitHub/Gmail/Calendar/X/Trello/Jira reads | PASS latest deployed backend read-only probes with provider log IDs; existing owner/configs retained |
| Reddit | BLOCKED by provider: real read returned HTTP 429, log `log_lGZmK9L06I_4`; authorization was not replaced |
| Instagram | BLOCKED by previously verified provider HTTP 403 / Personal account restriction; user chose to leave blocked, connection preserved |
| Reminders | PASS automated contracts and actual database ownership/write checks. Earlier manual create/edit/complete UI evidence is historical; physical notification delivery is NOT TESTED. |
| Paid Google Maps | BLOCKED by the user's choice to leave its API key unset. Existing OSRM/MapLibre development route flow is retained; previous real route UI evidence is historical. |

## Universal scenario matrix

| Requested scenario | Current verdict |
| --- | --- |
| BLR → CCU, 29 Nov 2026 | PARTIAL: actual sources and honest no verified date-specific INR fare; live bookable fare API unavailable. Initial route-price inference was a failed test and prompted stricter date/trip evidence validation. |
| Goa hotels / two guests | PASS clarification for missing stay dates; actual dated hotel-rate cards not verified |
| Bengaluru rental cars | PASS clarification for pickup/rental times; actual dated rental offers not verified |
| Netflix / Spotify / YouTube comparison | PARTIAL: real final reply persisted after reads; final native row/card refinement needs further acceptance testing |
| Laptops under INR 80,000 | RETEST REQUIRED: retrieval passed; initial final synthesis hit rate limits/validation failure. Source-list fallback worked in a later mixed-context test, which also exposed and fixed incorrect continuation of an older request. Full product-card acceptance is not claimed. |
| Restaurants / jobs / two products | NOT TESTED end to end in this final pass; native generic/category infrastructure exists |
| Company / multiple-source research | PASS source-backed Browserbase research and persisted source-list reopening; not every research domain certified |
| Route between locations | Historical OSRM UI PASS; not rerun in this final pass |
| Today's Gmail | PASS actual connected read and server-filtered empty result for exact India local-day boundaries. Earlier wrong-day result was a failed test, corrected with epoch queries and timestamp filtering. |
| Calendar events | Latest calendar-list read PASS; event-range UI summary not rerun |
| Normal programming | PASS actual UI, no unnecessary web retrieval |
| No reliable results | Source/no-results schema and failure handling tested; a separate real-world nonexistent-query test not run |
| Missing parameters | PASS actual hotel/rental clarification and model-classifier travel probe |
| Repeated query / caching | Actual retry used cached sources with original timestamps; unit/server controls passed. Full new-query dedup stress test not performed. |
| Cancellation | Development reload cancellation observed; explicit Stop during a fresh search not separately certified |
| Reopen rich conversation | PASS actual research envelope/source list survived reload |
| Light/dark | Both theme contrast/native contracts pass automated tests; dark retained in actual UI. Full manual toggle sweep not rerun. |

## Fixes found by actual testing

- Corrected Gemini JSON Schema transport and excessive constrained-decoding state complexity. Strict server-side schema/quote checks remain.
- Added bounded presentation repair and genuine natural-answer/source-list degradation, rather than endless failed composition calls.
- Reduced duplicated source context and aligned source IDs; retries can reuse owned, unexpired research evidence.
- Prioritized the newest user request and restricted single-domain email/calendar routing to connected tools, preventing older failed web searches from hijacking the next question.
- Replaced model date arithmetic for today's inbox with server-calculated local-day bounds, DST tests, exact Gmail epoch filters and returned timestamp verification. Google documents that calendar-date Gmail searches use PST, so epoch filters are required for other timezones.
- Fixed keyboard viewport handling, measured native offset, Android resize configuration, bounded multiline input and web auto-scroll dismissing focus.

Evidence files under ignored `.database-audit/` contain actual timings/screenshots/test output and are not committed because they can contain private user data. No fake provider successes or physical-device results are asserted. Use [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) for preview, device acceptance and production gates.

References: [Gmail date filtering](https://developers.google.com/workspace/gmail/api/guides/filtering), [Gemini function schema](https://ai.google.dev/api/caching#FunctionDeclaration), [Browserbase Search](https://docs.browserbase.com/platform/search/overview), [Browserbase Fetch](https://docs.browserbase.com/platform/fetch/overview).
