# Public Backend Plan

Brain Dump should be usable by people who do not have Cleveland Stewardship OS and should not write into the founder's Google Sheet by default.

## Product Model

1. A user opens Brain Dump and can try mock preview mode immediately.
2. The user chooses Connect Google.
3. Brain Dump requests only the scopes needed for Calendar, Tasks, and a user-owned workspace.
4. The user chooses existing Google Task lists and calendars or lets Brain Dump create defaults.
5. Brain Dump creates a per-user project/waiting workspace, either in the app database or in a Google Sheet owned by that user.
6. Processing a brain dump routes actions into that user's connected destinations.

## Recommended Architecture

- Frontend: current React + TypeScript + Vite PWA.
- Auth: Google OAuth through a server-side backend.
- Backend: serverless API or small Node service.
- Data store: per-user database records for preferences, idempotency keys, execution logs, and project/waiting data.
- Optional export: create a Google Sheet from a template for users who want their workspace in Drive.

## Google Scopes

Start narrow and ask for more only when features need them:

- OpenID/email/profile for sign-in.
- Google Tasks read/write.
- Google Calendar events read/write.
- Google Drive file create/read only if Brain Dump creates a user-owned workspace sheet.

Gmail should stay out of v1 execution. Keep email output in Needs Review until the user explicitly approves a draft/send workflow.

## Backend API Shape

Keep the existing process request/response contract:

```json
{
  "requestId": "uuid",
  "text": "Pay employees tomorrow. Lunch Thursday at noon; put on calendar.",
  "timezone": "America/Chicago"
}
```

The public backend should infer the user from the session, not from frontend-supplied Google IDs.

Initial routes are documented in `src/api/publicContract.ts`:

- `GET /api/workspace`
- `POST /api/auth/google/start`
- `POST /api/auth/google/disconnect`
- `POST /api/brain-dump`

## Safety Rules

- Never store Google client secrets in the PWA.
- Encrypt refresh tokens at rest.
- Log every action and failure with the request id.
- Use idempotency keys to prevent duplicate writes.
- Return Needs Review for ambiguous calendar items or email requests.
- Give users a Disconnect Google option that revokes tokens and disables writes.

## CSOS Compatibility

The Apps Script bridge remains useful as a private adapter, but it should be labeled as advanced/private. Public users should not need a Cleveland Stewardship OS spreadsheet, task-list IDs, calendar IDs, or Apps Script deployment URL.
