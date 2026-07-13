# Brain Dump Beta Launch Worksheet

Use this as the launch-day control sheet. Fill in the placeholders when deployment details are known. Do not commit real secrets.

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
| Google Cloud project | `[GOOGLE_CLOUD_PROJECT]` |
| OAuth client name | `[GOOGLE_OAUTH_CLIENT_NAME]` |
| Admin token storage location | `[PASSWORD_MANAGER_ITEM]` |

## Environment Checklist

Frontend:

- `VITE_SUPPORT_EMAIL=[SUPPORT_EMAIL]`

Backend:

- `GOOGLE_CLIENT_ID=[GOOGLE_CLIENT_ID]`
- `GOOGLE_CLIENT_SECRET=[GOOGLE_CLIENT_SECRET]`
- `BRAIN_DUMP_PUBLIC_API_ORIGIN=[PUBLIC_API_ORIGIN]`
- `BRAIN_DUMP_FRONTEND_ORIGIN=[FRONTEND_ORIGIN]`
- `BRAIN_DUMP_STORAGE_PREFIX=brain-dump-prod`
- `BRAIN_DUMP_ADMIN_TOKEN=[LONG_RANDOM_ADMIN_TOKEN]`

Do not paste real client secrets or admin tokens into this file.

## OAuth Test Users

| Name | Email | Added in Google OAuth Testing | Invite Sent | First Run Complete | Notes |
| --- | --- | --- | --- | --- | --- |
| `[Tester 1]` | `[email@example.com]` | No | No | No |  |
| `[Tester 2]` | `[email@example.com]` | No | No | No |  |
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
```

Expected:

- Requests without the admin header return `401` or `404`.
- Requests with the admin header return JSON.
- Metrics response contains counts only.
- Backup plan response says not to export Google refresh tokens.

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
[BETA_APP_URL]/app
```

Check deployed backend:

```sh
curl -i "[PUBLIC_API_ORIGIN]/api/health"
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
