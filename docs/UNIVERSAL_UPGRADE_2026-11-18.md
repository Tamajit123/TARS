# Universal response upgrade — development verification log

Repository: `Tamajit123/TARS`, branch `codex/tars-product-stabilisation`. This development log records intermediate findings. The final acceptance results and remaining gaps are in [RELEASE_VERIFICATION_2026-11-18.md](RELEASE_VERIFICATION_2026-11-18.md); deployment steps are in [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md).

## Implemented architecture

The existing Expo 58 / React Native app and authenticated Edge pipeline remain in place. Gemini 3.5 Flash-Lite is still selected. A model-classified plan extracts parameters with exact user quotes; validation rejects unsupported assumptions and asks for essential travel details. Existing Composio permissions and confirmation flows remain authoritative.

Browserbase Search and Fetch use the current supported REST APIs. Search produces original URLs and dated excerpts; Fetch checks public DNS, robots policy, content type, response size and challenges. Cloud/CDP remains the existing read-only JavaScript/live-preview path, with bounded sessions and cleanup. No arbitrary model JavaScript, authentication bypass, transaction or CAPTCHA handling is added. Arbitrary interactive forms remain outside this read-only adapter.

Replaceable research adapters publish capabilities, schemas, credentials required, timeout, freshness, rate limits and safe errors. Dedicated travel, shopping and weather adapters are not configured; those categories use permitted web discovery with explicit limitations, never certified bookable availability. No new dependency was installed for this work; existing Ajv validates model outputs.

Rich responses use a shared version-1 contract with 23 block types. Sources originate from actual tool results; structured fields require matching source quotes. Images must originate from provider metadata. Travel price items require dated trip-basis evidence. A missing date-specific fare produces sources and an explanation, not an invented cheapest offer. Native layouts support result collections, prices, details, comparisons, route maps, sourced charts and source actions in both themes. Ordinary questions retain genuine Markdown streaming.

The final presentation tool uses a simple JSON-string argument, followed by strict server-side schema and evidence validation. This avoids Gemini's observed constrained-decoding error: HTTP 400 `INVALID_ARGUMENT`, “schema ... too many states for serving.” The final structured call does not simulate text streaming; ordinary prose still streams actual provider text. Retried synthesis can reuse this owner's still-fresh evidence without rerunning retrieval.

An optional OpenAI adapter shares the transport contract and requires explicit server selection and model configuration. It is unit-tested only, not enabled or billed. Gemini remains active. OpenAI audio formats outside its configured adapter are rejected explicitly; Gemini media handling remains unchanged.

## Existing database

Existing project `bdswodobwesadjedzhfg` matches runtime, CLI link and saved VS Code connection. Baseline inspection preceded implementation. No project, database or conversation table was replaced.

Applied and read back:

- `20261117193305_universal_research_reservations.sql`: indexed owned research cache and service-only atomic reservations, with per-owner/global concurrency and rate limits.
- `20261117194700_rich_reply_recovery_metadata.sql`: a nullable, bounded JSON object for assistant recovery metadata. This additional recovery requirement was identified during implementation so a retry retains the rich payload as well as its text. No old records were rewritten.

Actual rollback verification passed original-message fingerprints, 14 RLS tables, anonymous/client RPC denial, service-role permission and atomic owner concurrency limits. Both private storage buckets and the existing cron dispatcher remain. Generated types match the read-back schema. Evidence: `.database-audit/universal-verification-20261118.json`.

## Mobile keyboard defect

Fixed native measured keyboard offset, Android resize configuration and mobile-browser visual viewport handling. The web tab bar hides for an actual visual-viewport keyboard; pinch zoom is not treated as a keyboard. Composer sizing stays local, expands to 112 px and then scrolls internally.

Actual typing exposed React Native Web's `on-drag` mode dismissing the keyboard on programmatic scrolling. Web now uses `none`; native iOS interactive dismissal and Android drag dismissal remain. At 390 × 450, real sequential typing through six lines retained focus, the input was 112 px high with 160 px scroll content, and the 44 px Send/Voice controls stayed inside the viewport. This is a compact-browser test, not a physical iOS/Android keyboard certification. Evidence screenshot: `.database-audit/mobile-composer-390x450-20261118.jpg`.

## Actual results so far

| Check | Result |
| --- | --- |
| Browserbase Search capability | PASS: 6 real sources, 1,687 ms |
| Browserbase Fetch capability | PASS: example.com, 750 ms including policy check |
| Source-backed Browserbase research in actual UI | PASS: saved rich envelope, 6 source links, reload retained layout; total 45,557 ms |
| Flight BLR → CCU, 29 Nov 2026 | Initial test exposed an unsupported route-price inference. Corrected parameter/price guards; follow-up returned no verified date-specific INR fare, actual source links and honest HTTP 403 limitations. Dedicated live fares remain unavailable. |
| Hotels, Goa, two guests | PASS clarification, 7,418 ms. Refined question to avoid re-asking supplied guest count. |
| Bengaluru rental cars | PASS actual UI clarification for pickup and rental times |
| Programming answer | PASS actual UI: natural Gemini explanation and fenced code, no unnecessary web call |
| Subscription comparison | Final AI reply persisted after real Search/Fetch, following schema and transient 503 failures. Retry used cached sources. Native comparison and balanced per-service attribution are being retested; do not label this complete yet. |
| iOS/Android physical keyboard, permissions/background delivery | BLOCKED: no physical device attached |

Earlier failures are retained in the test history. Some development reloads cancelled in-flight tests; those are not counted as completed response tests. The full 20-scenario matrix, media/reminders/live view regression, final exports and Git delivery remain to finish. Private provider data and credentials are excluded from this report and Git artifacts.
