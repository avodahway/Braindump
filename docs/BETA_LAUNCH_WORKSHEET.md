# Brain Dump Beta Launch Worksheet

Use this as the launch-day control sheet. Fill in the placeholders when deployment details are known. Do not commit real secrets.

## Current Staging Values

| Item | Value |
| --- | --- |
| Beta app URL | `https://brain-dump-vercel-deploy.vercel.app/app` |
| Frontend origin | `https://brain-dump-vercel-deploy.vercel.app` |
| Public API origin | `https://brain-dump-vercel-deploy.vercel.app` |
| Direct backend origin | `https://brain-dump-api-staging.onrender.com` |
| Support email | `avodahway@gmail.com` |
| Backend host | Render |
| Frontend host | Vercel |
| Storage provider | Supabase |
| Supabase URL | `https://crcavxfqlnjyyyrxfaca.supabase.co` |
| Supabase KV table | `brain_dump_kv` |
| Google Cloud project | `brain-dump-staging` |
| OAuth client name | Brain Dump staging web client |
| OAuth redirect URI | `https://brain-dump-vercel-deploy.vercel.app/api/auth/google/callback` |
| Admin token storage location | Host secret manager only; do not commit |
| Beta access code storage location | Host secret manager only; do not commit |

## Current Staging Verification

| Check | Result |
| --- | --- |
| GitHub `main` | `4bc9ea897bdf3ea9110e493cb4f83d0b98aeb6a4` |
| GitHub Actions CI | Passed |
| Vercel frontend deployment | Ready |
| `GET /api/health` through Vercel | Passed |
| Direct Render `/api/health` | Passed |
| OAuth callback route | Reaches Render backend |
| `pnpm verify:deployment` against staging | Passed |
| `pnpm smoke:oauth` from local shell | Blocked by missing `BRAIN_DUMP_BETA_ACCESS_CODE` in local environment |
| `pnpm validate:env` from local shell | Blocked by host secrets not available locally |

## Deployment Placeholders

| Item | Value |
| --- | --- |
| Beta app URL | `[BETA_APP_URL]` |
| Frontend origin | `[BRAIN_DUMP_FRONTEND_ORIGIN]` |
| Public API origin | `[BRAIN_DUMP_PUBLIC_API_ORIGIN]` |
| Support email | `[VITE_SUPPORT_EMAIL]` |
| Backend host | `[BACKEND_HOST]` |
| Frontend host | `[FRONTEND_HOST]` |
| Storage provider | `[DURABLE_STORAGE_PROVIDER]` |
| Supabase URL | `[SUPABASE_URL]` |
| Supabase KV table | `[SUPABASE_KV_TABLE]` |
| Google Cloud project | `[GOOGLE_CLOUD_PROJECT]` |
| OAuth client name | `[GOOGLE_OAUTH_CLIENT_NAME]` |
| Admin token storage location | `[PASSWORD_MANAGER_ITEM]` |

## Environment Checklist

Start from `.env.production.example`. Fill real values only in hosting provider secret settings or a local ignored env file.

Frontend:

- `VITE_SUPPORT_EMAIL=[SUPPORT_EMAIL]`

Backend:

- `GOOGLE_CLIENT_ID=[GOOGLE_CLIENT_ID]`
- `GOOGLE_CLIENT_SECRET=[GOOGLE_CLIENT_SECRET]`
- `BRAIN_DUMP_PUBLIC_API_ORIGIN=[PUBLIC_API_ORIGIN]`
- `BRAIN_DUMP_FRONTEND_ORIGIN=[FRONTEND_ORIGIN]`
- `SUPABASE_URL=[SUPABASE_URL]`
- `SUPABASE_SERVICE_ROLE_KEY=[SUPABASE_SERVICE_ROLE_KEY]`
- `SUPABASE_KV_TABLE=brain_dump_kv`
- `BRAIN_DUMP_STORAGE_SECRET=[LONG_RANDOM_STORAGE_SECRET]`
- `BRAIN_DUMP_STORAGE_PREFIX=brain-dump-prod`
- `BRAIN_DUMP_ADMIN_TOKEN=[LONG_RANDOM_ADMIN_TOKEN]`

Do not paste real client secrets or admin tokens into this file.

## OAuth Test Users

| Name | Email | Added in Google OAuth Testing | Invite Sent | First Run Complete | Notes |
| --- | --- | --- | --- | --- | --- |
| Jay Cleveland | `jcleveland3@gmail.com` | Yes | Internal test | Yes | OAuth, task, and calendar smoke succeeded |
| Avodah Way | `avodahway@gmail.com` | Yes | Internal test | Yes | OAuth, task, and calendar smoke succeeded |
| `[Tester 3]` | `[email@example.com]` | No | No | No |  |
| `[Tester 4]` | `[email@example.com]` | No | No | No |  |
| `[Tester 5]` | `[email@example.com]` | No | No | No |  |

## Admin Token Checks

Replace `[ADMIN_TOKEN]` and `[PUBLIC_API_ORIGIN]` locally before running. Keep the token in a password manager.

```sh
curl -i "[PUBLIC_API_ORIGIN]/api/admin/metrics"
curl -i -H "X-Brain-Dump-Admin-Token: [ADMIN_TOKEN]" "[PUBLIC_API_ORIGIN]/api/admin/metrics"
curl -i "[PUBLIC_API_ORIGIN]/api/admin/backup-plan"
curl -i -H "X-Brain-Dump-Admin-Token: [ADMIN_TOKEN]" "[PUBLIC_API_ORIGIN]/api/admin/backup-plan"
curl -i "[PUBLIC_API_ORIGIN]/api/admin/readiness"
curl -i -H "X-Brain-Dump-Admin-Token: [ADMIN_TOKEN]" "[PUBLIC_API_ORIGIN]/api/admin/readiness"
```

Expected:

- Requests without the admin header return `401` or `404`.
- Requests with the admin header return JSON.
- Metrics response contains counts only.
- Backup plan response says not to export Google refresh tokens.
- Readiness response returns `ready: true` before invite emails go out.
- Record the go/no-go call in `docs/LAUNCH_DECISION_RECORD.md`.

## Launch-Day Command Checklist

Run locally before deploy:

```sh
pnpm test
pnpm build
```

Check deployed frontend:

```text
[BETA_APP_URL]/
[BETA_APP_URL]/privacy
[BETA_APP_URL]/terms
[BETA_APP_URL]/support
[BETA_APP_URL]/data-deletion
[BETA_APP_URL]/feedback
[BETA_APP_URL]/beta
[BETA_APP_URL]/app
```

Check deployed backend:

```sh
curl -i "[PUBLIC_API_ORIGIN]/api/health"
curl -i -H "X-Brain-Dump-Admin-Token: [ADMIN_TOKEN]" "[PUBLIC_API_ORIGIN]/api/admin/readiness"
```

Run the deployment verifier:

```sh
BRAIN_DUMP_FRONTEND_ORIGIN=[BETA_APP_URL] \
BRAIN_DUMP_PUBLIC_API_ORIGIN=[PUBLIC_API_ORIGIN] \
BRAIN_DUMP_ADMIN_TOKEN=[ADMIN_TOKEN] \
pnpm verify:deployment
```

Manual app smoke test:

1. Open `[BETA_APP_URL]/app`.
2. Set Public API URL to `[PUBLIC_API_ORIGIN]` if needed.
3. Connect Google with a test user.
4. Confirm the OAuth callback returns to the app.
5. Submit: `Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.`
6. Confirm review-before-create appears.
7. Remove one planned action.
8. Review again and click Create.
9. Confirm created Google Task and Calendar event.
10. Submit: `Spend 4 hours this week on the website cleanup.`
11. Confirm vague calendar work stays in Needs Review.
12. Disconnect Google.
13. Confirm `/api/workspace` returns not connected for that browser session.

## Invite Send Checklist

- Replace `[BETA_APP_URL]` in `docs/FIRST_USER_BETA_PACKET.md` invite copy.
- Add each tester to Google OAuth test users.
- Send the invite.
- Schedule or request a watched first-run window.
- Create a support note for each tester.
- After their run, send the follow-up template.

## Daily Beta Review

During the first 5 testers:

- Check `/api/admin/metrics`.
- Review execution logs for write failures.
- Record parser mistakes.
- Record where onboarding confused people.
- Confirm no duplicate-write reports.
- Confirm all disconnect requests work.
- Update the beta issue log before inviting more testers.
