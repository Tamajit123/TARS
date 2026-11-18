# Existing database repair — 2026-10-26

## Composio follow-up

Migration 20261025222357 adds a server-owned `composio_sessions` mapping with owner-only RLS reads and service-only writes, bringing the current schema to ten public tables and five applied versions. Before applying it, a fresh metadata/fingerprint baseline included the user's newly created chat records; those values and records were preserved. No existing schema/data was replaced. Three real Composio integrations now work through both the SDK and deployed Gemini agent. See [Composio proof](COMPOSIO_SETUP.md). The sections below record the initial four-migration recovery.

## Project and preservation

The runtime EXPO_PUBLIC_SUPABASE_URL, linked CLI project, and saved VS Code PostgreSQL connection all identify **bdswodobwesadjedzhfg (TARS)**. No project was created or replaced. PostgreSQL connections verified TLS against the Supabase root certificate. Credentials stayed in memory; schema snapshots contain metadata and row fingerprints, not customer values.

Before repair, the live public schema contained profiles (2 rows), chat_threads (0), and chat_messages (0). The profiles table uses **name**, email and avatar_url; the application previously expected a different name column. Migration history was empty. Screenshots of an older Users table were not treated as live evidence: no such table exists in the inspected project.

After repair, original column values and row counts match their pre-migration fingerprints. Both existing profiles and Auth identities remain. Temporary execution fixtures were removed. No existing customer rows were deleted.

## Applied and verified migrations

| Version | Purpose |
| --- | --- |
| 202610230001 | Extend existing profile/chat tables; ideas, schedules, history, tool catalog and owner-scoped connections |
| 202610230002 | Message metadata/request IDs; chat recovery; restrictive owner policies; compatible Auth profile trigger; private avatar bucket |
| 20261025131949 | Composite ownership validation; daily/weekly timezone calculations; server-owned execution leases; atomic result/message completion; retry bounds |
| 20261025140452 | Private Vault-backed dispatcher; pg_net; one global pg_cron job every minute |

All four versions were read back from supabase_migrations.schema_migrations. Before application, pending SQL was validated inside a rolled-back transaction. Application used the linked project's supported Supabase CLI db push workflow. Existing bootstrap files were corrected before their first application because the live project had no migration history.

The final schema has nine public tables, all with RLS enabled: profiles, chat_threads, chat_messages, ideas, scheduled_agent_tasks, agent_tool_runs, user_tool_connections, tools, ai_chat_requests. Client access to connection/history/catalog mutation and server execution state is denied. Service-only claim/finish functions reserve work with SKIP LOCKED and bounded leases. Owner-message foreign keys and supporting indexes are present. The tars-avatars bucket is private, limits image size/types, and uses owner-folder policies.

## Verification evidence

- Live SQL role checks passed: profile retrieval; main/side conversations; message persistence; task creation/pause/resume; cross-user read/write/delete denial; anonymous denial; server-only execution controls; DST/timezone handling; exclusive claims; idempotent completion; execution history isolation.
- These checks used existing identities with PostgreSQL SET LOCAL ROLE and JWT claims in a transaction that was rolled back. They are database authorization checks, **not a new mobile Google sign-in test**.
- Real pg_cron → pg_net → deployed agent-run → Gemini → PostgreSQL succeeded. One response message was saved, the next occurrence persisted, and the lease released. Tagged fixtures were removed.
- A second real provider test proved Gemini called Browserbase to read example.com and used its returned title/URL in the persisted task response. The cloud session and tagged database records were cleaned up.
- Deployed chat and agent-run use the existing project's service credentials internally. Google-only OAuth configuration and user app.json changes were preserved.

## Reproduce

From D:\TARS, with the same authorized VS Code connection and the public CA file at .database-audit/supabase-root.crt:

~~~powershell
node scripts/database/inspect.cjs --use-vscode-connection --after
node scripts/database/verify.cjs --use-vscode-connection
node scripts/database/live-scheduler.cjs --use-vscode-connection
node scripts/database/live-scheduler.cjs --use-vscode-connection --dispatch-now --browser-probe
~~~

The live scheduler scripts create only tagged fixtures and remove them afterward. They call paid external services. The SQL verification script rolls back all fixtures. Do not run the inspection without --after after capturing a baseline, since before.json is the preservation baseline.

For future reviewed migrations, the exact application command is:

~~~powershell
node scripts/database/cli.cjs --use-vscode-connection db push --linked --skip-vault --yes
~~~

No migrations remain pending from this repair. Keep .database-audit and .env ignored. Provider keys must be configured only in existing-project Edge Function secrets. Device-level profile/avatar/chat checks still require a signed-in app session; none was fabricated during these checks.
