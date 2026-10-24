# Verification report — October 24, 2026

## Local commands

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS: 7 static security/migration tests, including Google-only sign-in and protected-route checks. |
| `npx expo config --type public` | PASS: resolved scheme is `tarsai`, Expo SDK 58. |
| `npx expo export --platform all --max-workers 1` | BLOCKED: Metro hit Windows `EMFILE` while opening a file in the Hugeicons package, including with one worker. |
| `npm audit --omit=dev` | Reports four high-severity transitive findings through Expo CLI → `node-forge@1.4.0`. [The advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) lists affected versions through 1.4.0 and no patched release; the findings are in build tooling, and the audit offered only an incompatible Expo 44 downgrade. No forced downgrade or unverified override was applied. |

## Coverage and limitations

Tests inspect security-critical source and SQL patterns. They do not execute PostgreSQL migrations, call a real Supabase project, invoke an AI provider, or exercise the app on Android/iOS. The Edge Function was not deployed or type-checked with Deno locally. Google OAuth has not been exercised on device. Browserbase and Composio action execution is blocked; only Composio connection status lookup is exposed, and needs deployed server credentials.

The supplied Supabase screenshots indicate the live project is missing columns/table that the app expected. The migration is additive and preserves `public."Users"` rows, but must still be reviewed and applied to the intended project. After deployment, verify Google sign-in and callback restoration, profile provisioning, owner isolation, main/new thread creation, and message retry after provider failure with real accounts.

No secrets or live customer data were printed by the verification commands. The local `.env` is ignored by Git and must remain local; set provider/service-role keys only as Supabase Edge Function secrets.
