# Setup and backend

## Local preview

1. Install Node.js 20.19+ and npm. Android Studio is only needed for an Android emulator; Expo Go can preview on a phone.
2. From the project folder:

   ```powershell
   npm install
   npm run start
   ```

3. Install Expo Go on the phone and scan the QR code. Select **Explore offline preview**. Local chat, ideas, and task drafts remain in AsyncStorage on that phone. No user account, server, or AI response is simulated.

## Cloud backend

Create a Supabase project and copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Set the project URL and public anon/publishable key in `.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

In the Supabase dashboard, enable Email OTP. Use the six-digit code template (`{{ .Token }}`) so the app can verify the code. For Google sign-in, configure a Google OAuth client and enable the Google provider in Supabase Auth. Add the Supabase callback URL (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) to Google’s authorized redirect URIs. Add `tarsai://auth/callback` to Supabase’s allowed redirect URLs.

Install and authenticate the Supabase CLI, link the project, then apply the schema and deploy functions:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy chat
npx supabase functions deploy agent-run
```

`chat` needs the provider key and optionally a model name. `agent-run` needs the Supabase service role key. Add values only to Supabase secrets; do not paste them into `.env` or the mobile app:

```powershell
npx supabase secrets set OPENAI_API_KEY=YOUR_SERVER_SIDE_KEY OPENAI_MODEL=gpt-4.1-mini SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the Supabase Edge Function environment. If your project does not provide them automatically, set those values as server secrets. Never prefix the service-role or provider key with `EXPO_PUBLIC_`.

After setting `.env`, restart Metro. Sign in with email or Google; cloud chat, ideas, and activity require an authenticated session. `npm run start` starts the local Expo server, while AI requests go to the deployed `chat` function.

## Scheduled tasks

Task drafts can be created locally. Cloud task creation and pause/resume require the migration. Actual execution additionally requires the Edge Function and OpenAI server key. A cron dispatcher uses pg_cron and pg_net; read [the function README](../supabase/functions/agent-run/README.md) and review every SQL placeholder before enabling it. Create a high-entropy `SCHEDULER_SECRET` in Supabase and store the same value in Vault for the cron request. Never reuse the Supabase service-role key as that secret.

Composio and Browserbase are optional and are not required for basic chat. Connector linking from native production builds is not configured yet. Do not set those providers up until you have reviewed [docs/SECURITY.md](SECURITY.md) and the function’s access and permission requirements.

## Secrets and local configuration

- `.env`: only public `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Supabase server secrets: `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCHEDULER_SECRET`, and optional third-party provider keys.
- EAS build profiles need the two public Supabase values added to each intended EAS environment in the Expo dashboard.
- `EXPO_PUBLIC_API_URL` is optional and only for a separately deployed trusted API serving legacy connector routes. It is not used for chat.
