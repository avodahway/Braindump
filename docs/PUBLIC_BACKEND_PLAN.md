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

- `GET /api/health`
- `GET /api/workspace`
- `POST /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/disconnect`
- `POST /api/brain-dump`

The current PWA includes a safe demo connection in public mode. It creates local-only destinations so the onboarding and processing flow can be tested without Google OAuth credentials. When a Public API URL is configured, `src/api/publicClient.ts` sends real requests to the public backend contract instead of using the demo process path.

`src/api/publicConnection.ts` is the frontend connection boundary. With a Public API URL configured, it starts backend OAuth and redirects to Google. Without one, it keeps the local demo connection path available.

`src/server/publicBackend.ts` contains a framework-neutral backend scaffold for these routes. It is intentionally pure TypeScript so it can be adapted to a serverless function, a small Node service, or an edge runtime.

`src/server/actionExecutor.ts` separates parsed actions from provider writes. The demo executor maps actions to user destinations now; a later Google executor can implement the same interface with real Tasks, Calendar, and workspace writes.

`src/server/googleExecutor.ts` defines that Google-ready adapter boundary. It accepts injected clients for Tasks, Calendar, and workspace records so the OAuth/token layer can be added without changing parser or routing behavior.

`src/server/googleProviderClients.ts` contains fetch-based Google REST clients for Tasks and Calendar, plus an in-memory workspace record client. Production can replace the memory workspace with a database-backed implementation while keeping the executor contract stable.

Calendar execution carries the request timezone through the executor context and sends Google Calendar local `dateTime` values with a `timeZone`, avoiding server-runtime timezone assumptions.

`src/server/oauthSession.ts` defines the OAuth state, token exchange, token storage, and default workspace creation flow. It uses interfaces for the token client and storage so production can plug in encrypted storage later.

`src/server/publicBackend.ts` now calls that OAuth flow directly for `/api/auth/google/start` and `/api/auth/google/callback`. The callback still uses injected token clients/stores, so real Google credentials can be added outside the PWA source.

`src/server/sessionStore.ts` adds cookie-based session storage. After OAuth callback, the backend sets an HttpOnly session cookie; later workspace and brain-dump requests use that session to find the user's stored workspace.

`src/server/googleOAuthClient.ts` is the fetch-based Google OAuth token client. It exchanges authorization codes for tokens and reads the OpenID profile through injected backend config, including the client secret.

`src/server/refreshingTokenProvider.ts` reads stored Google tokens and refreshes them before provider writes when they are near expiration.

`src/server/durableStore.ts` adds a framework-neutral key-value storage adapter for OAuth state, refresh tokens, workspaces, and sessions. A deployed backend can supply a managed store and encryption codec to `createBrainDumpBackend` without changing the parser, frontend, or Google execution code.

`src/server/runtimeConfig.ts` and `src/server/runtimeHandler.ts` are the deployable backend entry point. Required environment values are `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `BRAIN_DUMP_PUBLIC_API_ORIGIN`. Optional values are `GOOGLE_OAUTH_SCOPES` and `BRAIN_DUMP_STORAGE_PREFIX`.

`src/server/workspaceProvisioning.ts` provisions a public user's workspace after Google sign-in. It reuses existing `Brain Dump Work` and `Brain Dump Personal` task lists when present, or creates them in that user's Google Tasks account when missing.

`src/server/idempotencyStore.ts` persists processed brain-dump responses by request id. With durable storage configured, retries and backend restarts return the first response instead of writing duplicate tasks or calendar events.

`src/server/executionLogStore.ts` records every attempted action with request id, user id, status, provider id, and error message when one occurs. Production storage can retain this as the audit trail for support and debugging.

## Safety Rules

- Never store Google client secrets in the PWA.
- Encrypt refresh tokens at rest.
- Log every action and failure with the request id.
- Use idempotency keys to prevent duplicate writes.
- Return Needs Review for ambiguous calendar items or email requests.
- Give users a Disconnect Google option that revokes tokens and disables writes.

## CSOS Compatibility

The Apps Script bridge remains useful as a private adapter, but it should be labeled as advanced/private. Public users should not need a Cleveland Stewardship OS spreadsheet, task-list IDs, calendar IDs, or Apps Script deployment URL.
