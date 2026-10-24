# AI provider setup

The mobile app calls the authenticated Supabase `chat` Edge Function. Provider credentials are read only by that server function; never use an `EXPO_PUBLIC_` variable for an AI key.

## Chat provider

The current `chat` function uses Gemini only. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL=gemini-2.5-flash` as Supabase Edge Function secrets. It does not read `AI_PROVIDER` and does not fall back to OpenAI. Gemini model availability and quota depend on the Google account and region. Review current [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing), and [terms](https://ai.google.dev/gemini-api/terms) before choosing a tier.

## Scheduled task summaries

The existing `agent-run` scheduled chat-task flow can use OpenAI to draft task summaries. This is separate from chat. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL=gpt-4.1-mini` as server secrets only if enabling that flow. OpenAI API usage is billed separately from ChatGPT plans; review current [API pricing](https://developers.openai.com/api/docs/pricing).

## Set secrets and deploy

From a linked Supabase project, configure the selected provider and the service-role key used by authenticated server code:

```powershell
npx supabase secrets set GEMINI_API_KEY=YOUR_KEY GEMINI_MODEL=gemini-2.5-flash SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
npx supabase functions deploy chat
```

If you enable scheduled AI task summaries, also set `OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-4.1-mini`. Set server secrets in the Supabase dashboard or CLI; do not paste actual values into source, documentation, issue reports, or this chat. After deployment, inspect Edge Function logs for correlation IDs and error codes. The chat function intentionally avoids logging prompt or response text.

This function is a text chat endpoint. It has no live web access, streaming, or external action execution. The database rate check is per-user but can be approximate during concurrent requests; do not treat it as a billing-grade quota.
