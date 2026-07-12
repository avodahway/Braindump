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

Optional backend:

- `GOOGLE_OAUTH_SCOPES`
- `BRAIN_DUMP_STORAGE_PREFIX`

See `.env.example`.

## Frontend Routes

- `/`
- `/app`
- `/privacy`
- `/terms`

The frontend host must serve `index.html` for those routes.

## Backend Routes

- `GET /api/health`
- `GET /api/workspace`
- `POST /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/disconnect`
- `POST /api/brain-dump`

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
12. Keep app in testing mode for private beta.
13. Add invited beta users as test users.

## Smoke Test

After deploy:

1. Open `/`.
2. Open `/privacy`.
3. Open `/terms`.
4. Open `/app`.
5. Check backend health: `GET /api/health`.
6. In app settings, set Public API URL.
7. Click Connect Google.
8. Complete OAuth with a test user.
9. Submit: `Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.`
10. Confirm the review step appears before anything is created.
11. Remove one preview action and confirm it disappears.
12. Review again, then click Create.
13. Confirm Google Tasks has the work task.
14. Confirm Google Calendar has the event.
15. Submit: `Spend 4 hours this week on the porch replacement project`.
16. Confirm the calendar work block stays in Needs Review and is not created.
17. Click Disconnect.
18. Confirm stored OAuth tokens and workspace connection records are removed.
19. Confirm `/api/workspace` returns not connected afterward.

## Rollback

- Revert frontend to prior deployment.
- Revert backend to prior deployment.
- Disable the OAuth client if a bad release affects sign-in.
- Keep execution logs and idempotency records for incident review.

## Do Not Launch Publicly Until

- Privacy policy is final enough for public use.
- Terms are final enough for public use.
- Durable storage is encrypted.
- OAuth verification path is understood.
- Disconnect and support paths are tested.
