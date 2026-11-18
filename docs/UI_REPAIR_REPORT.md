# TARS UI repair report — 2026-10-26

## Scope and outcome

Implemented the requested repairs in the existing Expo app and existing Supabase project `bdswodobwesadjedzhfg`. Also applied the keyboard repair to the Scheduled Agents & Goals editor and Edit Agent modal, as requested during implementation. No new project, database reset, schema migration, or RLS relaxation was needed for this repair. The checkout already contained earlier TARS repairs; this report describes this UI repair batch.

## Causes and changes

| Issue | Cause | Implemented behavior / principal files |
| --- | --- | --- |
| Missing provider marks/names | The catalog can return null logo URLs; the UI then rendered initials. Row backgrounds used a white token with theme-dependent text, and names depended on incomplete metadata. | `src/constants/providers.ts`, `providerLogos.ts`, `src/components/tools/ProviderLogo.tsx`, `ToolCard.tsx`, `ManageToolModal.tsx`, and the tools tab use shared provider names and distinct bundled SVG marks. Flexible text and truncation preserve the action area. Status and actions continue to use the real backend. |
| Unstructured / misleading tool responses | Browser rows were separate trailing cards with legacy summary fields. There was no shared progress/result model; a challenge page could be reported as a successful page read, and expired views were not distinguished from active views. | `supabase/functions/_shared/execution.ts`, `browser.ts`, `agent.ts`, `composio.ts`, `src/components/chat/ExecutionCard.tsx`, `src/lib/chatTimeline.ts`, `src/types/execution.ts`, and the chat tab now use typed real execution state, chronological cards and final replies, actual returned results, and explicit unavailable browser views. Challenge pages fail honestly. Gemini receives the current UTC date to reduce incorrect date interpretation seen in the supplied screenshot. |
| Profile always showed Save | Inputs were always editable without a saved-value snapshot. Photo selection uploaded immediately, using an overwritten avatar object, so a failed profile update could affect the old image. | Settings opens in view mode. Edit Profile reveals fields; trimmed dirty comparison controls Save Profile; Cancel restores the last acknowledged values. Validation and a synchronous save lock guard submission. `src/lib/profileState.ts`, `avatarPersistence.ts`, `auth.ts`, and the settings tab stage photos for confirmation, upload to a unique private object, obtain its signed preview, then update the profile reference with an acknowledged row response. A failed operation retains the draft. Only an unreferenced new object is eligible for cleanup; old objects are not overwritten. |
| Keyboard covered Save | Idea and task sheets were unbounded non-scrolling forms. Edit Agent used an iOS-only keyboard wrapper around a non-scrolling card. | `src/components/common/KeyboardFormLayout.tsx` bounds the card to the available space, applies iOS padding / Android height avoidance, reserves safe areas, scrolls fields and keeps Save/Cancel outside the field scroller. Ideas, Scheduled Agents & Goals, and Edit Agent now share it. Idea details retain multiline input and focused-field scrolling. Synchronous locks prevent duplicate saves; errors preserve drafts. |

Additional implementation/support files: `scripts/fetch-provider-logos.cjs`, `assets/providers/ATTRIBUTION.md`, `scripts/database/checks.cjs`, `live-scheduler.cjs`, the private provider-health branch of `supabase/functions/agent-run/index.ts`, `tests/ui-repair.test.cjs`, `tests/edge-runtime.test.cjs`, and `tests/security.test.cjs`.

### Provider marks

Gmail, Slack, Google Calendar, Notion, Instagram, Reddit, GitHub, X (Twitter), Trello, and Jira. Provider IDs and aliases resolve centrally. Nine marks come from the logo URLs verified in Composio toolkit metadata; X uses the Simple Icons CC0 glyph. Attribution is retained in `assets/providers/ATTRIBUTION.md`. Existing `react-native-svg` renders them; no icon dependency was added. Known marks use a consistent white backing in both themes. Unknown future providers retain the backend-image fallback.

### Execution delivery

The existing Gemini agent writes owner-scoped `agent_tool_runs.metadata.execution` updates as actual Browserbase milestones occur: connection, navigation, and reading. Intermediate/final cards use actual page title, excerpt, links and available table cells. Composio cards store only compact confirmed result metrics and their provider log ID. They do not store raw provider/OAuth payloads.

The chat screen reads the existing execution table with RLS and conversation filtering, polling every 1.2 seconds during a request or running execution. This is persisted progress delivery, not token streaming or a second agent. User messages appear immediately; tool rows and the final persisted assistant reply are ordered by actual timestamps. Ordinary text replies continue through the same chat endpoint.

The state model supports planning, running, intermediate, awaiting confirmation, completed, failed, cancelled, timed out and partial results. The UI does not invent stages the server has not emitted. Timeouts and stale status are labelled explicitly. Browser views require an active row, an unexpired provider-issued HTTPS Browserbase URL, and an available flag. Released sessions have their live URL removed. The current read-only browser is short-lived and releases after reading; its Open Browser action can therefore be brief, and becomes disabled after release. The screen does not manufacture persistent session links or flight prices.

Both `chat` and `agent-run` were deployed to the existing project. The final private provider diagnostic was deployed to `agent-run` and verified.

## Verification

`PASS` means executed successfully. Unit checks with controlled boundaries are explicitly distinguished from real service checks.

| Check | Status | Evidence / limit |
| --- | --- | --- |
| `npm test` | PASS | 23 tests: controlled keyboard-layout rendering for iOS/Android/web, shared editor/save guards, provider registry and both-theme card rendering/callbacks, dirty validation, avatar failure cleanup, timeline ordering, live URL expiry/validation, blocked browser pages, and existing security checks. These are unit checks, not device tests. |
| `npm run typecheck` | PASS | Expo/application TypeScript. |
| `npm run typecheck:edge` | PASS | Shared Edge Functions TypeScript, including final diagnostic change. |
| `npm run lint` | PASS | Expo lint. |
| `npx --no-install expo export --platform all --max-workers 1` | PASS | iOS, Android and web exports after archiving obsolete routes and uninstalling unused packages. Export is not an installed-device build/test. |
| `node scripts/check-client-bundle.cjs` | PASS | 93 exported files scanned; none contained the locally configured server-secret values. Values were not printed. This does not inspect server-only secrets absent from local configuration. |
| Real database persistence and RLS | PASS | Existing VS Code connection matched app/CLI project. Authenticated owner-role SQL wrote/read profile name/preferences and a multiline idea; checked conversations/messages, schedules, execution history, cross-owner and anonymous denial. All verification writes were rolled back. Original snapshot fingerprints matched at the start of this verification. |
| Real scheduled browser request | PASS | Run `97166786-e903-48df-982a-aa572ff6347f`: database dispatch → pg_net → deployed agent → Gemini → Browserbase → result/message persistence. Actual Example Domain results and at least three stored progress steps verified; result delivered once; lease released; next occurrence saved; browser marked unavailable and live URL removed. Only tagged fixtures were removed. |
| Real active Browserbase view | PASS | Separate private diagnostic used the same `readPublicPage` implementation without model dependency: actual Example Domain title/content, three real milestones, and temporary provider view HTTP 200. The capability URL was not logged or saved in this report. Device tapping is not verified. |
| Ordinary Gemini generation | PASS | Private provider probe returned a genuine two-character model response. |
| Gemini reliability across repeated tool runs | FAIL | Two additional scheduled browser attempts returned provider/model reply failures; test fixtures were removed. A successful run does not establish provider reliability. Requests retain honest errors/retry behavior. |
| Existing Composio provider configuration | PASS | Real provider-health request returned HTTP 200 with three auth configurations. No account was disconnected for a visual regression test. |
| Git whitespace / cleanup review | PASS | Diff checked with CR-at-EOL handling for Windows. All 141 tracked archive destinations verified. `.env`, project-ref, `LICENSE`, and `TARS.png` remain in TARS. Earlier unrelated working changes were preserved. |
| Physical keyboard-open saves / small-device navigation | BLOCKED | Native computer-use runtime initialization failed with a kernel-assets path error; no accessible Android adb executable was found. The unit layout checks and exports do not prove a real on-screen keyboard interaction. |
| Signed-in profile reopening, native photo picker and real avatar upload from the app | NOT RUN | No usable signed-in device/UI session was available. Storage restrictions are covered by existing SQL/security checks; avatar transaction/failure behavior is covered by controlled unit tests. |
| Live connect/disconnect, refresh/reopen on a device | NOT RUN | Existing account authorizations were preserved. Callback wiring/theme rendering is unit-tested; the real Edge service configuration was checked. |
| Visual small-viewport and both-theme device review | NOT RUN | Both themes were rendered in controlled component tests; no screenshot/device acceptance claim is made. |

Initial intermediate checks caught an obsolete avatar test expectation and a render-time clock purity error; both were repaired and the final suite passed. The five high-severity dependency advisories still reported by npm remain unresolved; no forced major Expo downgrade was applied.

## Cleanup

See `CLEANUP_MANIFEST.md` for every tracked file removed from the application tree and its recoverable archive location. This batch moved 129 reference inspection files and 12 obsolete active-tree files, plus the untracked reference checkout and ignored extracted references, to `D:\TARS-reference-archive-20261026`. The first Windows move stopped at an empty hidden directory; the verified remaining move completed without overwriting archive contents. The nested reference Git HEAD and license, and extracted re.zip screenshots, are present in the archive.

The six obsolete Expo Node API routes were discovered dynamically by Expo Router but are unnecessary for the existing static export: the active client routes its operations through `supabase.functions.invoke('agent-run')`. Their six Node agent/browser support files had no remaining active consumers. The deployed Gemini/Browserbase/Composio Edge implementations are retained and verified.

Npm removed these five direct dependencies and regenerated the lockfile: `@browserbasehq/sdk`, `@browserbasehq/stagehand`, `@composio/openai-agents`, `@openai/agents`, `zod`. They were consumed only by archived adapters. Npm removed 35 packages in total. The unused Stagehand override was removed; `@composio/core` remains for operator scripts. Obsolete modal/logo style declarations were also removed. No authentication source, migration, required brand asset, local environment, database configuration or license was deleted. Private audit files and generated exports remain ignored development artifacts.

## Remaining manual acceptance

On the device, open New task in Scheduled Agents & Goals; fill the multiline instructions, choose weekly and a weekday, focus the time field, and tap Save with the keyboard open. Repeat when editing an existing task. Check Edit Agent name saving with the keyboard open, then repeat New idea with long details. Reopen each list to confirm the saved record. Repeat in light/dark mode and a small viewport. Test one network failure to confirm the draft remains available.

Profile/avatar device acceptance and an actual tap on a live browser view remain necessary before describing the app as fully verified. Additional integrations require their genuine provider configuration/authorization; the UI does not hardcode connected accounts.
