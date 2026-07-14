# Brain Dump Deployment Runbook

This runbook is for the first private-beta deployment.

## Required Decisions

- Production domain.
- Frontend host.
- Backend host.
- Durable encrypted storage provider.
- Support email for `VITE_SUPPORT_EMAIL`.
- Google OAuth project and consent screen owner.

## Environment Variables

Frontend:

- `VITE_SUPPORT_EMAIL`

Backend:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BRAIN_DUMP_PUBLIC_API_ORIGIN`
- `BRAIN_DUMP_FRONTEND_ORIGIN`

Optional backend:

- `GOOGLE_OAUTH_SCOPES`
- `BRAIN_DUMP_STORAGE_PREFIX`
- `BRAIN_DUMP_ADMIN_TOKEN`

See `.env.example`.

## Frontend Routes

- `/`
- `/app`
- `/privacy`
- `/support`
- `/data-deletion`
- `/terms`

The frontend host must serve `index.html` for those routes.

## Backend Routes

- `GET /api/health`
- `GET /api/workspace`
- `POST /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/disconnect`
- `POST /api/brain-dump`
- `POST /api/events`
- `GET /api/admin/metrics`
- `GET /api/admin/backup-plan`
- `GET /api/admin/readiness`

`GET /api/health` is anonymous and should return:

```json
{
  "ok": true,
  "service": "brain-dump-public-backend",
  "time": "..."
}
```

## Google Cloud Setup

1. Create or choose a Google Cloud project.
2. Enable Google Tasks API.
3. Enable Google Calendar API.
4. Configure OAuth consent screen.
5. Add app name: `Brain Dump`.
6. Add support email.
7. Add app logo.
8. Add authorized domain.
9. Add privacy and terms URLs.
10. Create a Web OAuth client.
11. Add redirect URI: `${BRAIN_DUMP_PUBLIC_API_ORIGIN}/api/auth/google/callback`.
12. Set `BRAIN_DUMP_FRONTEND_ORIGIN` to the frontend origin so OAuth returns users to `/app`.
13. Keep app in testing mode for private beta.
14. Add invited beta users as test users.

## Smoke Test

After deploy:

1. Open `/`.
2. Open `/privacy`.
3. Open `/terms`.
4. Open `/support`.
5. Open `/data-deletion`.
6. Open `/app`.
7. Check backend health: `GET /api/health`.
8. In app settings, set Public API URL.
9. Click Connect Google.
10. Complete OAuth with a test user and confirm the app returns to `/app?connected=google`, then clears the query.
11. Submit: `Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.`
12. Confirm the review step appears before anything is created.
13. Remove one preview action and confirm it disappears.
14. Review again, then click Create.
15. Confirm Google Tasks has the work task.
16. Confirm Google Calendar has the event.
17. Submit: `Spend 4 hours this week on the porch replacement project`.
18. Confirm the calendar work block stays in Needs Review and is not created.
19. Click Disconnect.
20. Confirm stored OAuth tokens and workspace connection records are removed.
21. Confirm `/api/workspace` returns not connected afterward.
22. If `BRAIN_DUMP_ADMIN_TOKEN` is set, confirm `GET /api/admin/metrics` returns event counts only when `X-Brain-Dump-Admin-Token` is provided.
23. If `BRAIN_DUMP_ADMIN_TOKEN` is set, confirm `GET /api/admin/backup-plan` returns the storage categories and operator checklist only when `X-Brain-Dump-Admin-Token` is provided.
24. If `BRAIN_DUMP_ADMIN_TOKEN` is set, confirm `GET /api/admin/readiness` returns `ready: true` before inviting users.

## Backup And Restore

Before inviting real beta users:

1. Use a backend storage provider with encrypted snapshots or point-in-time recovery.
2. Set `BRAIN_DUMP_STORAGE_PREFIX` to a stable production value.
3. Set `BRAIN_DUMP_ADMIN_TOKEN` to a long random value.
4. Call `GET /api/admin/backup-plan` with `X-Brain-Dump-Admin-Token`.
5. Confirm the plan covers OAuth tokens, workspaces, sessions, idempotency responses, execution logs, and analytics events.
6. Take a provider-level encrypted snapshot before every backend deploy during beta.
7. Test restore in staging with a non-production Google account.
8. After restore, verify `/api/health`, `/api/workspace`, duplicate request behavior, `/api/admin/metrics`, and Disconnect Google.

Do not export Google refresh tokens to local files, spreadsheets, or support notes. Use encrypted provider snapshots for secret-bearing records.

## Rollback

- Revert frontend to prior deployment.
- Revert backend to prior deployment.
- Disable the OAuth client if a bad release affects sign-in.
- Keep execution logs and idempotency records for incident review.
- Use the latest known-good encrypted storage snapshot if the backend storage layer is corrupted.

## Do Not Launch Publicly Until

- Privacy policy is final enough for public use.
- Terms are final enough for public use.
- Durable storage is encrypted.
- OAuth verification path is understood.
- Disconnect and support paths are tested.
