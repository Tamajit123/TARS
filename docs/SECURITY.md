# Security notes

## Implemented boundaries

- Client configuration accepts only the public Supabase URL and anon/publishable key.
- Chat provider calls happen in `supabase/functions/chat`, after JWT validation. Provider keys are read only from the function environment.
- Chat history queries use the authenticated user ID; request-body user IDs do not grant access.
- The `agent-run` function resolves user identity from a valid JWT for manual calls. Cron dispatch requires a dedicated `SCHEDULER_SECRET`.
- The core migration enables RLS on user data and grants authenticated access only to owner-scoped records. The tools catalog is opt-in (`enabled = true`).
- Chat inputs have role, size, and count validation. Provider errors returned to the client are generic.
- `.gitignore` excludes `.env`, signing material, and references.

## Not yet verified or implemented

- The migration and RLS policies have not been run against a Supabase project. Verify with two distinct test accounts before storing real data.
- Rate limiting and abuse quotas are not implemented in the chat Edge Function. Add edge/API limits before public release.
- Account deletion, export, retention controls, and secure deletion are not implemented in-app.
- The legacy Composio API routes need a separately hosted trusted server for production native builds. Review and test every connector permission before enabling it.
- The inherited `agent-run` function has not been reviewed against live provider responses or deployed. Its optional third-party tools are disabled until configured.
- Privacy and terms pages describe current behavior but should be reviewed for the target launch jurisdictions and providers.
- No production security audit or penetration test has been performed.

## Secret handling

Do not put `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `COMPOSIO_API_KEY`, `BROWSERBASE_API_KEY`, or `SCHEDULER_SECRET` in `.env`, app config, Expo public variables, screenshots, or Git. Store them with `npx supabase secrets set`. Use a separate random scheduler secret and restrict access to the Vault SQL. If a real credential is committed or shared, revoke and rotate it.
