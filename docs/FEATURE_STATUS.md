# Feature status — October 23, 2026

## Implemented in source; not device-tested here

- Expo Router mobile shell with Chat, Activity, Ideas, Tasks, and Settings destinations.
- TARS branding, provided artwork, graphite/amber design tokens, and safe-area-aware navigation.
- Email OTP and Google OAuth flows using Supabase Auth.
- AsyncStorage offline preview for conversation history, ideas, and task drafts.
- Supabase chat history, ideas CRUD, activity read path, and RLS migration.
- Authenticated, server-side AI request function with configurable model and server-only key.
- Daily task creation, pause/resume, and an authenticated manual/cron runner path.
- Privacy and terms screens describing current behavior.
- EAS development, preview APK, and production profiles.

## Implemented but unverified against real services/devices

- Supabase login/session restoration, Postgres writes, RLS enforcement, Edge Function deploy, task execution, and activity feed.
- EAS build profiles and icon assets.
- Type checks, lint, static security tests, and platform exports are pending command execution.

## Requires external credentials or accounts

- Cloud authentication, sync, and AI replies: Supabase project; AI replies also need an AI provider key.
- Google login: Google OAuth client and Supabase provider setup.
- Scheduled execution: deployed `agent-run`, server-side OpenAI key, and optionally pg_cron/pg_net/Vault.
- iPhone standalone build: Expo account, Apple Developer membership, signing, and device provisioning for internal installs.
- Android EAS build: Expo account; Play Store distribution additionally needs a Play Console account.
- Integrations: Composio/Browserbase credentials and production hosting for trusted connector routes; not ready for public use.

## Requires paid service or account

- Apple Developer Program for signed physical-device internal distribution and App Store release.
- AI provider usage may incur charges under that provider’s plan.
- Supabase, Expo/EAS, Composio, Browserbase, and Google quotas/pricing depend on each account and can change; review their current plans before enabling them.

## Not implemented

- Light/system theme and persisted appearance selection.
- Streaming chat, chat retry UI, chat rename/search/clear/export, user-facing goals, and task execution history details.
- Full profile/preferences sync, account deletion/export, push notifications, billing/subscriptions, real activity summary generation, integration OAuth in native production, and analytics.
- Live service verification, device end-to-end runs, native EAS builds, and production security review.
