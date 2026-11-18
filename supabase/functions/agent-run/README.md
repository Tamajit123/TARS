# TARS agent-run

This deployed Deno function verifies user bearer tokens itself. It never accepts a body userId as identity. Scheduler/diagnostic modes require SCHEDULER_SECRET. Service-role credentials are server-only; no request body selects an account owner.

Supported modes: run_due_schedules, run_scheduled_task, list_connections, tools_catalog, tool_connect, tool_status, tool_disconnect, provider_health (private diagnostic).

The shared Gemini agent exposes validated, read-only Browserbase browse_page/search_web functions with execution history and bounded calls. Composio modes implement user-scoped OAuth connection management, not arbitrary action execution. Saved external-action payloads are rejected. Failures remain failures in history.

Schema and cron setup are versioned exclusively in ../../migrations. Do not apply older standalone schema snippets. The actual existing-project repair and live test evidence are documented in ../../../docs/LIVE_DATABASE_REPORT.md and ../../../docs/TEST_REPORT.md.

Deploy: npx --no-install supabase functions deploy chat agent-run --project-ref bdswodobwesadjedzhfg --use-api

Secrets/configuration: see ../../../docs/AI_PROVIDER_SETUP.md. The existing scheduler has one minute cadence, private Vault lookup, exclusive task claims, atomic message/history completion, and bounded retries. It uses Gemini, not an unconfigured OpenAI draft fallback.
