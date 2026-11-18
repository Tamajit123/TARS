# Existing-project provider operations

The app continues to use Supabase project `bdswodobwesadjedzhfg`. Store secrets in that project's **Edge Functions → Secrets**. Never put credentials in `EXPO_PUBLIC_*`, client code, screenshots or reports. Do not replace working Composio/Browserbase credentials.

## Gemini

`GEMINI_API_KEY` is server-only; `AI_MODEL` (or legacy `GEMINI_MODEL`) selects an explicit available model. Current primary is `gemini-3.5-flash-lite`, explicitly authorized by the owner on 17 November after 3.6 Flash high-demand failures. A real 3.5 Flash-Lite streaming probe returned 435 characters in six chunks before changing configuration. No automatic OpenAI or model fallback occurs. Existing transport preserves real streaming, cancellation, thought signatures and conversation history; bounded inference retries use exponential backoff. External actions are not retried by this mechanism.

Use `node scripts/database/provider-health.cjs --use-vscode-connection --diagnostics` for redacted model access/generation/streaming evidence. A model-list HTTP 200 is not proof of generation, quota or free-tier eligibility. In **Google AI Studio → Dashboard → Usage and rate limits**, select the key's actual project to verify RPM/RPD, tier and regional availability. Do not add billing without the user's choice. Current generation tests and exact results are in the delivery report.

OpenAI has no remote key/model configured. An unused local key is not copied. To enable it requires an explicitly chosen provider implementation/model and a valid server credential with quota; it remains BLOCKED rather than a hidden paid fallback.

The 16 November provider error identified this project's 20 requests/day free-tier allocation. Its reset is past; 17 November's direct generation now returns HTTP 503 UNAVAILABLE (high demand), not proof of continued daily exhaustion. TARS distinguishes these errors. Model generation has a bounded 90-second window; the agent's multi-call turn now has a 135-second budget, reserving its last minute for an answer rather than further tool rounds. Ordinary text-only transport retains its 105-second default. After verified tools, Gemini 3.6 Flash uses minimal thinking while retaining real results/signatures. [Timing repair and actual retests](GEMINI_POST_TOOL_FIX_2026-11-17.md). Switching model or enabling billing is a separate owner decision.

Current connected-read blockers: Reddit HTTP 429 after Composio retries; Instagram HTTP 403 because the authorized account is Personal. The owner chose to leave Instagram blocked. Preserve both authorizations; do not recreate configurations to mask provider restrictions.

## Free Maps

Server configuration:

```
MAPS_PROVIDER=osrm
OSRM_BASE_URL=https://your-routing-service.example.org/
PHOTON_BASE_URL=https://your-geocoder.example.org/
MAPS_DEMO_MODE=false
```

For this development deployment only, `MAPS_DEMO_MODE=true` explicitly enables the public Photon and OSRM demos. The service-only `claim_tars_map_run` RPC reserves real execution rows and limits requests globally to one per 1.1 seconds and per owner to eight per minute. It protects both manual and AI map calls. This does not provide an availability guarantee or permission for bulk requests. Configure hosted/self-hosted endpoints before production; public demos are not production infrastructure. OSRM's configured driving profile has no live traffic, walking or cycling. Locations are explicitly selected, not guessed from ambiguous names. The app can redirect to Google Maps using a Directions URL without a Google Routes API key.

Native MapLibre requires a **new development/production build** with its config plugin; Expo Go cannot supply that native module. Old builds show an availability explanation instead of crashing. OpenFreeMap's Liberty style is the default web/native tile source, with map attribution enabled; no offline downloading or tile prefetch is implemented. `EXPO_PUBLIC_MAP_STYLE_URL` may point at another licensed style. Existing Google Maps provider remains available if explicitly configured with `MAPS_PROVIDER=google` and restricted `GOOGLE_MAPS_API_KEY` (Routes + Places New APIs).

References: [OSRM API](https://project-osrm.org/docs/v5.24.0/api/), [Photon](https://github.com/komoot/photon), [MapLibre Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/), [OpenFreeMap](https://openfreemap.org/quick_start/).

## Research and browser workloads

Connected service reads go through the existing Composio account and reviewed tool schema. Browserbase is retained for real page navigation/extraction/live view. It is not used for Maps or as a substitute for account APIs.

The search adapter supports explicit API-first configurations without adding another browser framework:

```
WEB_SEARCH_PROVIDER=searxng
SEARXNG_BASE_URL=https://your-search-instance.example.org/
```

Enable JSON in your own SearXNG `search.formats` configuration. Alternatively choose `WEB_SEARCH_PROVIDER=brave` with server-only `BRAVE_SEARCH_API_KEY`; its current account plan/quota must be checked before enabling. Neither provider is configured in this project yet. Without them, the existing Browserbase search remains available and reports challenge pages as failures. An API error never silently switches providers. Source snippets are untrusted retrieved content, not model instructions.

Playwright requires a browser process outside the Edge runtime; Stagehand/Browser Use would add another agent runtime/provider dependency. They are not installed merely for search. Browserbase already supplies the required cloud browser and live viewer, and has passed the deployed extraction/live endpoint probe. API adapters avoid allocating a browser for research once configured. A real speed comparison of unconfigured search services is BLOCKED; no latency figures are invented.

References: [SearXNG Search API](https://docs.searxng.org/dev/search_api.html), [Brave Search API](https://api-dashboard.search.brave.com/api-reference/web/search/get).

## Native permissions

Expo Audio, Image Picker, Document Picker and Notifications remain tied to Expo 58. Permission prompts must be completed on a real device. Ordinary notifications follow system Silent Mode/Focus and cannot guarantee alarm-style ringing. Real iPhone/Android permission denial, background delivery, lock-screen sound and restart tests require installed rebuilt apps; browser tests do not certify those behaviors.
