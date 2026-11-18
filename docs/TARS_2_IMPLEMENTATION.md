# TARS 2.0 implementation plan — 2026-11-02

## Baseline and preservation
- Checkpoint: refs/checkpoints/tars-2-pre-upgrade-20261102 (1e7408771e090769d5d2a4117c0877adf8fcddd2); untracked source backup in ignored .database-audit/pre-tars-2-untracked-20261102.zip.
- Expo 58.0.17 / RN 0.88 / React 19.3 / Router 58 / Reanimated 4.7 / Gesture Handler 3.3.
- Existing Supabase project, Google authentication, RLS and account mapping remain authoritative. No reset, replacement project, secret exposure, auth-config recreation or destructive migration.
- Prior real UI verification (28 October): Google sign-in, Gemini reply, Reddit preferences, X profile, Trello boards, Jira issue read, Browserbase public read/search; browser viewer visual verification incomplete.
- Current source: completed responses; basic Markdown subset; seven narrow Composio reads; no general write approval workflow. Feed, Ideas, tasks/history, settings/profile/theme persist to Supabase. Existing schemas and scheduler must remain compatible.

## Execution order
1. Inspect and record live configuration, schema, data counts and provider availability. Baseline tests/build; run app and reproduce current UI. Required design skills installed and read before layout changes.
2. Gemini streaming provider abstraction (updated user instruction: no OpenAI credits) and real semantic streaming; bounded context, server-only key, idempotent persistence, cancellation and recovery. Migrate ordinary and scheduled generation together. Gemini is the explicitly selected active provider; no OpenAI calls.
3. Dynamic Composio discovery under existing authenticated user/session, schema validation and real execution. Add useful reviewed reads, account authorization status and structured results. Consequential writes require a server-created, user-approved, immutable pending action with idempotent execution.
4. Refine semantic colors/system typography; native spacing/navigation/materials; rich responses (Markdown/code/tables/links), stream controls and compact expandable execution cards, in-app browser view. Preserve keyboard/save behavior and current themes.
5. Apply restrained UI-thread motion, Reduce Motion, haptics and user-controlled scrolling. Refresh TARS icon from existing brand assets, configure supported appearance variants.
6. Test real scenarios A–F where credentials/permissions/sources allow. Explicitly report BLOCKED for missing billing/account permissions or inaccessible flight sources; never invent prices or claim a real external action from a stub.
7. Typecheck app/Edge; tests; web/native bundle; secret scan; actual UI checks; accessibility/token contrast and motion code review. iOS device performance requires physical device/release build; do not claim simulator/device measurements from Windows builds.

## Provider decision
- Gemini is active by explicit user request. OpenAI billing is not required and no OpenAI API calls are made. An earlier OpenAI probe was superseded by this decision.
- Design skill sources: dickwu/apple-design-skill; emilkowalski/skills (animate-expo, animate, review-animations, improve-animations, find-animation-opportunities, animation-performance, animation-vocabulary).

## User scope correction
The user declined OpenAI API billing and explicitly requested Gemini for the same product outcome. Gemini remains active. The OpenAI migration requirement is superseded; streaming, tools, safety, presentation and redesign requirements remain.
