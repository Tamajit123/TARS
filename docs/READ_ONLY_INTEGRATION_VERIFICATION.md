# TARS real read-only verification — 27 October 2026

## Outcome

All four newly connected providers passed through the deployed TARS Gemini agent, not only through connection status checks or direct SDK calls. The existing Supabase project, stable user `8951a060-b880-4e55-80a4-6b61b390eceb`, saved Composio session and provider auth configurations were reused. Slack, Notion and Instagram were not reconnected, modified or revoked.

| Provider | Real AI-selected operation | Actual result | Composio log ID |
| --- | --- | --- | --- |
| Reddit | `REDDIT_GET_ME_PREFS` | PASS — authenticated language/night-mode preferences returned | `log_tTEL-Zt5z5AW` |
| X | `TWITTER_USER_LOOKUP_ME` | PASS — authenticated user profile returned | `log_fumB1aRoHNWT` |
| Trello | `TRELLO_GET_MEMBERS_BOARDS_BY_ID_MEMBER` | PASS — zero boards returned | `log_onJMHcmT3Qe7` |
| Jira | `JIRA_SEARCH_ISSUES` | PASS — zero issues assigned to current user for the tested query | `log_qI4BcYpDoJr5` |

Each test used the deployed `agent-run` function via the existing database dispatcher, pg_net and the shared `generateAgentReply` implementation also imported by `chat`. It verified the actual tool execution record, Composio log ID, final AI response saved exactly once, schedule completion and lease release. Only uniquely tagged test conversations/tasks/history were removed afterward. Original user data and schedules were preserved. These are backend integration tests; a signed-in physical-device UI session was not automated.

## Repairs

- The AI previously exposed only GitHub, Gmail and Calendar. `composioReads.ts` adds the four reviewed read operations, strict argument validation and provider-specific response projections. These operations cannot send messages or modify provider data. Reddit access is intentionally preferences only, X access profile only, and Trello access board listing only; posts, cards and writes are not claimed as implemented.
- Reddit's public-profile action requires a username. Its attempted self alias returned an embedded provider error despite an outer completed result. The authenticated preferences action is the verified read used here. Result processing now checks both the outer session status and the actual payload, including HTTP error fields and expected data structure. Unexpected payloads cannot become empty-success results.
- The read-only agent budget supports up to six calls across four model rounds, allowing a request to read all four services. A regression test verifies four tool responses can be processed in one turn; live provider tests were run individually.
- The configured `gemini-3.5-flash-lite` model returned HTTP 503 / UNAVAILABLE after three attempts. Existing credentials remained valid. The server was explicitly changed to `AI_MODEL=gemini-3.1-flash-lite`; a real default-model text probe and all four tool conversations passed. The provider stays Gemini, with no silent provider switching.
- Browserbase itself passed an actual `example.com` read and live-view HTTP 200. Saved app failures were `search_web` calls blocked by Google. Search now uses DuckDuckGo's public HTML endpoint, deduplicates actual result URLs and rejects result-less challenge shells. It does not solve CAPTCHAs or claim blocked pages were retrieved.
- The deployed Gemini → Browserbase search → final saved answer passed (run `663fa151-d197-432f-9990-4cb7155595b1`). A real Browserbase view was observed and returned HTTP 200 while active. The answer cited an actual Browserbase documentation result, and the released session was marked unavailable.
- Chat now allows 120 seconds for the existing bounded server agent turn and reads safe server error messages from function errors, rather than showing only a generic HTTP invocation failure.

## Validation

37 controlled regression tests pass, including embedded provider failure handling, argument restrictions, four-service tool budget, search destination parsing, connection preservation, JWT checks and browser challenge rejection. App/Edge TypeScript and lint pass. Both existing Edge Functions were deployed successfully. Production iOS/Android/web export passed on retry outside the sandbox after the initial sandbox-temp Hermes compilation failed. The final 17:53:45 UTC account check confirmed all four tested accounts and the original Slack/Notion/Instagram accounts remained ACTIVE.

Reproducible commands (use only with authorized existing-project operator access):

```powershell
node scripts/database/provider-health.cjs --use-vscode-connection --probe --browser-probe
node scripts/database/live-scheduler.cjs --use-vscode-connection --dispatch-now --user-id=8951a060-b880-4e55-80a4-6b61b390eceb --read-provider=reddit
# Replace reddit with twitter, trello or jira for the other reads.
node scripts/database/live-scheduler.cjs --use-vscode-connection --dispatch-now --user-id=8951a060-b880-4e55-80a4-6b61b390eceb --search-probe
```

No API keys, OAuth credentials, provider tokens or live browser capability URLs are stored in this report. Run IDs/log IDs are diagnostic references, not credentials.

## Try in TARS

- “Read my Reddit language and night-mode preferences.”
- “Read my connected X profile.”
- “List my Trello boards.”
- “Show up to five Jira issues assigned to me.”
- “Search the web for Browserbase live-view documentation and cite the result.”
- “Use the browser to read https://example.com and tell me its title.”

## Official references consulted

- [Composio session execution and connection state](https://docs.composio.dev/reference/sdk-reference/typescript/session): retained the existing user-scoped session execution API.
- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite): confirms the selected stable model supports function calling.
- [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling): model selects tool calls; TARS executes its validated read allowlist and returns tool results.
- [Browserbase session live URLs](https://docs.browserbase.com/reference/api/session-live-urls): temporary browser views are separate from server-only CDP connection credentials.
