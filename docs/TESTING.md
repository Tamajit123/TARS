# Testing and verification

## Automated commands

```powershell
npm run typecheck
npm run lint
npm test
npx expo export --platform android
npx expo export --platform ios
```

`npm test` runs repository-level static checks for the owner-scoped schema and server authorization boundaries. These checks do not replace a live database/RLS test or device acceptance run. Expo exports validate the JavaScript bundle; they do not compile native iOS or Android projects.

## Manual acceptance status

| Scenario | Status |
| --- | --- |
| Launch in offline preview | Available; device run still required |
| Local ideas and task draft persistence | Implemented; device run still required |
| Email OTP / Google sign-in | Implemented; requires Supabase and provider configuration |
| Session restoration / sign-out | Implemented; requires a configured account to verify |
| Chat AI reply | Edge Function implemented; requires OpenAI and Supabase credentials |
| Provider failure | Generic error response implemented; live failure path unverified |
| Cloud conversations / RLS isolation | Migration implemented; live two-account test required |
| Activity feed | Reads persisted task-run records; requires a configured backend |
| Task execution / cron | Function materials present; deployment and real execution unverified |
| Theme persistence | Not implemented; dark theme only |
| Connected integrations | Not ready for native production hosting |
| Offline handling | Local writes supported for ideas, tasks, and conversation history; cloud offline behavior needs device testing |
| App Store / APK native builds | Not run; EAS account and signing/device setup required |

Record actual command output and manual device results here after running them. Do not mark an item tested based only on static inspection.
