# Composio working integration — 2026-10-26

## Verified real results

The existing Platform project key works. The former `ck_` credential belonged to Composio For You. No key or project was created or rotated. The working existing credential was deployed through the existing Supabase secret loader; no key value is in source or this report.

GitHub, Gmail, and Google Calendar were authorized through Composio Connect Links. Runtime tool discovery and actual SDK execution returned:

| Integration | Discovered tool | Safe result | Log ID |
| --- | --- | --- | --- |
| GitHub | GITHUB_GET_THE_AUTHENTICATED_USER | Tamajit123; 36 public repositories | log_RuRzedDJMqOT |
| Gmail | GMAIL_LIST_LABELS | 15 labels | log_awXuI7AxwTlG |
| Google Calendar | GOOGLECALENDAR_LIST_CALENDARS | 34 calendars | log_bN8LY0eYaprI |

The deployed Gemini agent also completed all three reads, using the same session and actual provider calls:

- GitHub: `log_OchC1rruCx2C`
- Gmail: `log_XKHdnq5X-y1c`
- Calendar: `log_D6cOvXZO4oYq`

Its result message was persisted exactly once, the next occurrence saved, and the lease released. Tagged verification records were removed. No email bodies, event contents, or external writes were requested. This verifies the deployed agent path; a new device OAuth session was not fabricated or claimed.

## What changed

- `supabase/functions/_shared/composio.ts` adds the three reviewed reads through the REST **v3.1 Session API**. It validates arguments, verifies the active account belongs to the current user, stores execution/log metadata, and returns only relevant result fields.
- `supabase/functions/_shared/agent.ts` exposes those tools to the existing Gemini loop alongside Browserbase. The current model, prompt boundaries, conversation persistence and request lifecycle remain in place; no parallel agent/framework was added.
- `supabase/functions/_shared/connections.ts` starts managed connection links through the Session API. Settings → Connected services verifies live status.
- `scripts/composio-first-call.mjs` is a reproducible operator entrypoint using the already installed `@composio/core` 0.17.0. It discovers tool names/schemas at runtime and reuses the backend's session.
- Migration `20261025222357_composio_user_sessions.sql` persists one server-owned session per existing Supabase user. Owner-only RLS reads and service-only writes protect the mapping. The migration was applied through the linked CLI and read back; pre-existing chat records/values were preserved against a fresh fingerprint baseline.
- Chat execution cards identify Composio and display its real log IDs.

Identity mapping for this setup: existing TARS Auth UUID `8951a060-b880-4e55-80a4-6b61b390eceb` → Composio session `trs_HooKyU0hyPHG`. Each user's mapping is separate. No provider token or API key is stored in the mapping table.

An explicit REST account selector returned HTTP 400 (request `bb93efd9-e619-4023-ad9a-464256320f17`). Omitting it, matching the working SDK call, returned HTTP 200 and log `log_X845OoWcwSgq`. The deployed implementation uses the verified session account.

## Try next

Use the same Google login in TARS, refresh Settings → Connected services, then ask:

- “Show my GitHub profile and public repository count.”
- “List my Gmail labels.”
- “List my Google calendars.”

Activity shows execution status and log IDs. Find a log under Composio Dashboard → Platform → Logs.

Repeat the SDK proof from this workspace:

```powershell
node scripts/composio-first-call.mjs --use-vscode-connection --call
```

For fresh local operator state, discover first, connect if needed, bind, and call:

```powershell
node scripts/composio-first-call.mjs --use-vscode-connection --discover --connect --bind --call
```

The ignored `.database-audit/composio-session.json` contains local session/discovery/authorization state and safe proof summaries. Do not commit it. Provider credentials stay in the existing server secret mechanism. Only the three reviewed reads are enabled; sending email, changing events and other external writes remain unavailable.

## Documentation consulted

- https://docs.composio.dev/reference/sdk-reference/typescript/session
- https://docs.composio.dev/reference/sdk-reference/typescript/sessions
- https://docs.composio.dev/reference/api-reference/tool-router
- https://docs.composio.dev/docs/instant-tools
- https://docs.composio.dev/reference/authenticating-to-composio
