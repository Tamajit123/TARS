# AI and integration setup

Current operations, provider selection and required dashboard actions are documented in [Provider operations](PROVIDER_OPERATIONS.md). With the owner's explicit approval on 17 November, Gemini remains primary and is configured as `gemini-3.5-flash-lite` after repeated 3.6 Flash high-demand failures. No automatic provider/model fallback occurs. Earlier reports using 3.6 or 3.1 are historical, not the current configuration.

The app calls the existing project's authenticated `chat` and `agent-run` Edge Functions. Provider credentials remain server-only. Replies use genuine incremental SSE, cancellation and request-ID-based persistence/retry recovery. Completed replies are saved once; interrupted streams are not labeled completed.

Current Gemini tests returned real HTTP 200 text, stream, structured JSON and function calls. Provider demand also caused HTTP 503 and timeouts; account quota errors remain explicit. Availability does not establish a free-tier allocation. See the [current delivery evidence](DELIVERY_2026-11-16.md).

Composio uses the existing Platform configs and stable user-scoped sessions. A fresh link is generated per attempt; Connected requires verified ACTIVE status. API reads are preferred to browser automation. Existing Browserbase is retained for read-only public navigation, extraction and short-lived live views; it cannot log in, purchase, execute model-supplied JavaScript or submit forms. Search supports optional SearXNG/Brave APIs; the current Browserbase fallback remains until an API endpoint/key is configured.

Deploy to the existing project:

```powershell
npx --no-install supabase functions deploy chat agent-run --project-ref bdswodobwesadjedzhfg --use-api
node scripts/database/provider-health.cjs --use-vscode-connection --diagnostics --case=stream
node scripts/database/provider-health.cjs --use-vscode-connection --browser-probe
```

Diagnostics require the private scheduler secret and never return credentials or response contents. Never use `--sync-provider-keys` to overwrite a corrected remote credential from a stale local file.
