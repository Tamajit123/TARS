# Fresh Composio authorization — 2026-10-27

## Repair

The previous hosted links expired after their ten-minute authorization window. An initializing record does not prove OAuth completion. The installed SDK is `@composio/core` 0.17.0. Its normalized connected-account response omits `user_id`; the raw v3.1 API retains it, so ownership verification uses that API rather than guessing an identity field.

The existing backend now calls `POST /api/v3.1/connected_accounts/link` with the authenticated TARS user ID and the provider's existing, verified `auth_config_id`. It does not create or replace auth configurations. Every Connect attempt makes a new POST, including when the previous attempt is pending or expired. Existing ACTIVE accounts are returned as connected without creating a replacement.

The server validates the configuration's toolkit, the hosted HTTPS origin, the returned account ID, and the future expiration timestamp. It returns only a limited DTO: hosted URL, expiry, account/config IDs, status and the configured return target. It never returns the project API key, `link_token`, OAuth credentials or provider tokens. URLs remain in component memory only and are never written to the database or device storage. The operator audit saves IDs/status/timestamps, not URLs.

Tools & Connections opens each newly generated link immediately, displays it while pending, discards it after expiry, and prevents double taps while a connection window is opening. Returning to TARS and pending-status polling check Composio again. Only `ACTIVE` and enabled accounts become Connected. The current pending account ID is preferred over older failed attempts; a valid existing ACTIVE account takes precedence.

## Existing mappings used

TARS user: `8951a060-b880-4e55-80a4-6b61b390eceb`, verified against the existing `composio_sessions` mapping in the existing Supabase project.

| Provider | Existing auth configuration |
| --- | --- |
| Reddit | `ac_gSz2Ti2g7u4k` |
| X / Twitter | `ac_exeg02zepATk` |
| Trello | `ac_GEQiV3B6TneN` |
| Jira | `ac_RMLEe_TAlDaW` |

No credential or missing-config request was necessary for this repair.

The user's Jira screenshot reports: "Connected account not found for link token ... The link token may be invalid, expired, or the connected account may have been deleted." Its link matches the older 16:57 UTC attempt, whose account is EXPIRED. The replacement generated at 17:25 UTC remained INITIALIZING at the 17:27 UTC live check. After the user completed consent, the 17:32:56 UTC check verified Jira ACTIVE. No configuration replacement was necessary.

## Verification so far

| Check | Status | Evidence |
| --- | --- | --- |
| Four fresh link requests | PASS | Each real v3.1 POST returned HTTP 201; the returned account was fetched and its owner, toolkit and auth-config ID matched. Links generated at approximately 16:57 UTC, 27 October 2026, with ten-minute expirations. The user was given the genuine links immediately. |
| Slack preserved | PASS | Existing account `ca_B7ZzgofGsL_7` remained ACTIVE before and after generation. |
| Notion preserved | PASS | Existing account `ca_nulyyqfsxmRq` remained ACTIVE before and after generation. |
| Instagram preserved | PASS | Existing account `ca_g_Uc83hcxaxA` remained ACTIVE before and after generation. |
| Reddit OAuth completion | PASS | Live owner-scoped Composio check at 17:25 UTC returned ACTIVE. Older EXPIRED attempts are ignored. |
| X OAuth completion | PASS | Live owner-scoped Composio check at 17:25 UTC returned ACTIVE with the existing custom OAuth configuration. No OAuth validation was bypassed. |
| Trello OAuth completion | PASS | Live owner-scoped Composio check at 17:25 UTC returned ACTIVE. |
| Jira OAuth completion | PASS | After fresh-link consent, the real owner-scoped Composio check at 17:32:56 UTC returned ACTIVE using existing configuration `ac_RMLEe_TAlDaW`. Older EXPIRED attempts do not override it. |
| Controlled regression tests | PASS | Eight new tests cover the four provider flows, explicit IDs, fresh requests, ACTIVE-only completion, protected connections, foreign ownership, config mismatch and invalid redirect origins. Full suite: 34 passing at this checkpoint. |
| Application / Edge TypeScript and lint | PASS | Executed after the repair. |
| iOS / Android / web export | PASS | All three production exports completed. Client bundle scan checked 95 files and found none of the configured server secrets. |
| Physical-device browser handoff | NOT RUN | No signed-in device UI was controlled for this check. |

## X-specific requirements

X uses its existing custom OAuth2 configuration. It is not managed auth. Link creation alone does not prove X credentials, callback registration, permissions or account access. The subsequent real OAuth completion was verified as ACTIVE at 17:25 UTC. No validation was bypassed.

The toolkit's inspected default OAuth callback is `https://backend.composio.dev/api/v1/auth-apps/add` when no explicit `oauth_redirect_uri` is supplied. This provider callback is separate from TARS's `tarsai://tools` app return URL. If X reports a callback mismatch, the X Developer Portal callback must match the URI selected in the existing Composio auth config. Do not replace either with an invented production domain.

## Files

`supabase/functions/_shared/connections.ts`, `src/app/(tabs)/index.tsx`, `src/components/tools/ToolCard.tsx`, `src/services/tools.ts`, `src/types/tools.ts`, `scripts/refresh-connection-links.mjs`, `tests/connection-links.test.cjs`, and the updated endpoint assertion in `tests/security.test.cjs`.

## Official references

- [Create a new auth link session, API v3.1](https://docs.composio.dev/reference/api-reference/connected-accounts/postConnectedAccountsLink)
- [Connected Accounts: expiration, lifecycle and reconnection](https://docs.composio.dev/kb/guide/platform-connected-accounts)
- [Auth configuration and callback selection](https://docs.composio.dev/docs/authentication/programmatic-auth-configs)
