# Backend and authentication audit

## Confirmed from source and supplied screenshots

1. **Chat schema mismatch.** The screenshot's visible `chat_threads` columns omit `type` and `has_unread_updates`; the app queried those fields. `chat_messages` is not visible in the table list, while app history code expects it. The bootstrap migration uses `CREATE TABLE IF NOT EXISTS`, which does not add missing columns to a pre-existing table. Those mismatches explain the app's conversation-load and save failures.
2. **Legacy identity table is not Auth.** `public."Users"` has an integer identity and a numeric token column and is shown with RLS disabled. The app's secure owner model uses `auth.users.id` UUIDs. Mapping old rows by email would be unsafe without reviewing the actual constraints and confirming ownership. The new migration preserves rows and closes Data API access.
3. **The old chat path could report a false save failure.** It inserted a message and then updated its thread in a separate request. If the second write failed, the UI reported the message was unsaved even though it existed; a retry could duplicate it.
4. **The old chat request trusted client-supplied history.** The mobile client submitted a message array and saved the AI response itself. The revised Edge Function accepts one message, verifies the session, checks thread ownership, loads context from the database, and owns message persistence.
5. **Authentication offered methods outside the requested Google-only model.** The entry route contained email/password, email OTP, phone OTP, verification, and password-reset flows. Those forms and handlers have been removed; Google is now the only account sign-in method shown. Offline preview remains a clearly labeled local-only mode.

## Remediation in this workspace

- Added `202610230002_auth_chat_recovery_storage.sql` as an additive migration. It reconciles chat columns, creates `chat_messages` and idempotency storage, adds restrictive per-owner policies, provisions profiles for new Auth users, creates a private avatar bucket with folder ownership policies, and locks down the legacy `Users` table without altering its data.
- Reworked the chat Edge Function to verify user tokens and conversation ownership, keep AI keys server-side, limit message/context sizes, time-bound provider requests, persist both sides of a conversation, and recover retries by request ID.
- Updated the mobile chat to use the server API and retain a safe retry state.
- Implemented the Google-only OAuth welcome flow, duplicate-tap guard, callback identity check, session restoration, and protected-tab redirect.
- Added static security regression tests.
- Restricted `agent-run` to its explicit scheduler, owned scheduled-task, and authenticated connection-status modes. Arbitrary client-selected Browserbase/Composio actions and scheduled tasks carrying external-action payloads are rejected; debugger/live-view URLs are no longer returned. Task UI reports success only after the server confirms completion, and run-count query failures are surfaced rather than shown as zero.
- Aligned provider setup docs with the implemented Gemini-only chat handler and separate optional OpenAI scheduled-summary flow.

## Limits of this audit

- No Supabase MCP/database connection or usable Supabase CLI was available. The production schema was not queried, and no remote SQL/function deployment occurred.
- The screenshots show the visible table list and column headers only. They do not reveal policy expressions, triggers, constraints, indexes, hidden tables, or existing row relationships.
- No original function logs were available, so the generic UI error was not reproduced against the live service. The screenshot/source mismatch is the confirmed likely cause, not a live runtime trace.
- The new migration assumes the Supabase standard `auth.users`, `storage.objects`, `storage.buckets`, and `supabase_auth_admin` objects/role exist. Review it against the target project before applying.
