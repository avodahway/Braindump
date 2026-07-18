# OAuth Verification Assets

Prepare these before expanding beyond Google OAuth test users.

## Required Product URLs

- Production home page:
- Production app page:
- Privacy policy:
- Terms of service:
- Support page:
- Data deletion page:
- Launch status page:

## Google Cloud Console Evidence

- OAuth app name:
- Authorized domain:
- Support email:
- Developer contact email:
- OAuth redirect URI:
- Requested scopes:
- Test users:

## Scope Justification

| Scope | Why Brain Dump needs it | User-facing feature |
| --- | --- | --- |
| `openid email profile` | Identify the connected user session | Per-user Google connection |
| `https://www.googleapis.com/auth/tasks` | Create reviewed Google Tasks in the user's account | Work and personal tasks |
| `https://www.googleapis.com/auth/calendar.events` | Create reviewed calendar events in the user's account | Clear dated events |

## Demo Video Checklist

- Show the home page and public privacy/support links.
- Open `/app` in preview mode.
- Load or paste a sample brain dump.
- Click Review and explain that no Google write happens yet.
- Remove one preview action.
- Connect Google with a test user.
- Click Create only after review.
- Show created Google Tasks and Calendar event.
- Show Disconnect Google.
- Show data deletion instructions.

## Verification Readiness

- `docs/DEPLOYMENT_SMOKE_TEST.md` completed for production.
- `docs/LAUNCH_DECISION_RECORD.md` completed for public beta expansion.
- `/api/admin/readiness` returns `ready: true`.
- Durable storage and `BRAIN_DUMP_STORAGE_SECRET` are configured.
- Support and data deletion request intake have been tested.
