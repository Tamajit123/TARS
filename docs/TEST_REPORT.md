# Verification reports

## Preview deployment follow-up — 18 November 2026

Web preview is deployed and final hosted route/bundle checks pass. Native packaging fixes pass 112 regression tests. Android is compiling on EAS; iOS phone signing is blocked by the owner's lack of Apple Developer membership. See [PREVIEW_DEPLOYMENT_2026-11-18.md](PREVIEW_DEPLOYMENT_2026-11-18.md) for actual statuses and [PHONE_TESTING_AND_SIGNING.md](PHONE_TESTING_AND_SIGNING.md) for owner steps. Physical-device delivery is not certified.

## Current release check — 18 November 2026

See [actual release verification and explicit remaining gaps](RELEASE_VERIFICATION_2026-11-18.md) and [deployment plan](DEPLOYMENT_PLAN.md). All 111 automated tests and all three platform JS/static exports pass. Current live provider and multimodal checks are recorded separately from historical results and untested native-device behavior.

## Current report — 16–17 November 2026

See [current actual verification and blockers](DELIVERY_2026-11-16.md) and [successful Gemini post-tool final replies](GEMINI_POST_TOOL_FIX_2026-11-17.md). Owner-approved Gemini 3.5 Flash-Lite now passes actual Trello and four-service final-response tests with saved replies. Free Maps and Browserbase live view passed actual UI tests. Reddit is rate-limited and Instagram has an account-type restriction; physical-device acceptance remains blocked. Older reports below are historical, not the current release verdict.

## Historical report — 2026-10-26

| Check | Result |
| --- | --- |
| App TypeScript | PASS: npm run typecheck |
| Actual Edge source against pinned supabase-js types | PASS: npm run typecheck:edge |
| ESLint | PASS: npm run lint |
| Unit/source regression suite | PASS: 12 tests; browser URL/private-address guards, provider error handling, unknown write-tool rejection, RLS/schema/auth/retry contracts |
| Android, iOS and static web export | PASS: npx expo export --platform all --max-workers 1, with TEMP/TMP pointing to D:\TARS\.expo\temp |
| Live migration history | PASS: all five versions read back from the existing project, including Composio session mapping |
| Original row preservation | PASS: baseline original-column fingerprints and counts match; profiles remain 2 rows |
| Live owner isolation / DB operations | PASS: eight grouped checks, all test writes rolled back |
| Real scheduled generation | PASS: pg_cron → pg_net → deployed agent-run → Gemini → one persisted reply; next run and lease verified |
| Real Browserbase read | PASS: example.com title/text returned; session released |
| Real Gemini browser-agent execution | PASS: model called browse_page; completed tool record and response persisted; tagged fixtures removed |
| Composio authentication and reads | PASS: three authorized integrations; real SDK and deployed Gemini reads with log IDs; see COMPOSIO_SETUP.md |
| npm audit --omit=dev | FAIL: 5 high transitive findings in Expo CLI's node-forge/Zod dependencies |
| Mobile Google OAuth / device UX / push | NOT EXECUTED in this run |

The export warns that retained legacy +api.ts routes are excluded by static web output. App connection requests now use the deployed Supabase Edge Function, so the core connection flow does not depend on those routes.

Live database details and exact commands are in [LIVE_DATABASE_REPORT.md](LIVE_DATABASE_REPORT.md). SQL role checks are not a replacement for testing an authenticated mobile session. Unit provider/browser boundaries are controlled; they are distinct from the separately completed real provider tests. No customer values, access tokens or secret keys are included in reports.

## Reference validation (earlier inspection)

The independent Muse clone is clean at b1df0365e57dfbc4324da84c33f2c4e0db865a82. Its normal npm ci failed peer compatibility; --legacy-peer-deps --ignore-scripts installed dependencies for inspection. TypeScript and Expo configuration passed. Reference lint was unavailable because ESLint was absent. Reference web export did not finish and browser interaction was not verified. See [comparison](REFERENCE_COMPARISON.md) for ZIP and source findings.
