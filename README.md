# Brain Dump

Brain Dump is an installable React + TypeScript + Vite PWA for turning a free-form brain dump into routed actions for Google Calendar, Google Tasks, projects, waiting-on items, and later Gmail.

Tagline: **Get it out. We'll handle the rest.**

## Local Setup

```sh
pnpm install
pnpm dev
```

The app starts in mock preview mode. It parses and groups results locally without touching any Google account.

Public launch pages are available at `/`, `/privacy`, `/terms`, `/support`, `/data-deletion`, `/feedback`, `/beta`, `/status`, `/faq`, `/security`, `/install`, `/roadmap`, `/press`, `/examples`, `/pricing`, `/demo`, `/oauth-demo-checklist`, and `/timeline`. The product tool is available at `/app`.

Set `VITE_SUPPORT_EMAIL` at build time to show the live beta support address in public pages and feedback links.
Set `VITE_PUBLIC_API_BASE_URL` at build time so public pages can submit beta access requests to the backend.

Production deployment scaffolding is included for Vercel, Render, and Supabase:

- `vercel.json` serves the PWA and rewrites app routes to `index.html`.
- `render.yaml` defines the public Node backend service.
- `docs/PRODUCTION_DEPLOYMENT.md` walks through the required host settings.

## Checks

```sh
pnpm test
pnpm build
pnpm build:backend
```

With production environment values available, run `pnpm validate:env` before inviting real users.

After a real frontend and backend are deployed, verify public pages, search/share metadata, `/operator`, backend health,
protected operator feeds, and CSV exports with:

```sh
pnpm verify:deployment
```

After deployment verification, run the OAuth start smoke test against the deployed backend:

```sh
pnpm smoke:oauth
pnpm rehearse:restore
```

It uses `BRAIN_DUMP_PUBLIC_API_ORIGIN`; if invite-only beta is enabled, also provide `BRAIN_DUMP_BETA_ACCESS_CODE`.
The restore rehearsal also requires `BRAIN_DUMP_ADMIN_TOKEN`.

## Backend Direction

Brain Dump is moving toward a public multi-user model:

- Mock preview: local parser and fake created results.
- Public Google account setup: planned OAuth backend where each user connects their own Google account.
- Private CSOS bridge: optional adapter for one Cleveland Stewardship OS Apps Script deployment.

No Google credentials should be stored in the frontend. The public backend should store refresh tokens server-side, encrypt secrets at rest, and let each user choose or create their own Brain Dump workspace.

When a Public API URL is configured in Settings, public mode posts to:

- `GET /api/workspace`
- `POST /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/disconnect`
- `POST /api/account/delete`
- `POST /api/beta/request`
- `POST /api/feedback`
- `POST /api/support/request`
- `GET /api/admin/launch-summary`
- `POST /api/brain-dump`

With a Public API URL configured, the Connect button starts the backend OAuth flow and redirects the browser to the returned Google authorization URL. Without a Public API URL, public mode keeps using a local demo workspace.

See `docs/PUBLIC_BACKEND_PLAN.md` for the product/backend path.

Go-to-market planning lives in:

- `CHANGELOG.md`
- `docs/BETA_LAUNCH_PLAN.md`
- `docs/DEPLOYMENT_RUNBOOK.md`
- `docs/DEPLOYMENT_SMOKE_TEST.md`
- `docs/PRODUCTION_DEPLOYMENT.md`
- `docs/LAUNCH_URLS.md`
- `docs/RELEASE_GATE.md`
- `docs/GOOGLE_OAUTH_VERIFICATION.md`
- `docs/OAUTH_VERIFICATION_ASSETS.md`
- `docs/GO_TO_MARKET_CHECKLIST.md`
- `docs/HOSTING_DECISION.md`
- `docs/SUPABASE_STORAGE.md`
- `docs/FIRST_USER_BETA_PACKET.md`
- `docs/BETA_LAUNCH_WORKSHEET.md`
- `docs/BETA_COHORT_PLAN.md`
- `docs/LAUNCH_ANNOUNCEMENT_KIT.md`
- `docs/LAUNCH_ASSET_CHECKLIST.md`
- `docs/BETA_USER_INTERVIEW_GUIDE.md`
- `docs/LAUNCH_RISK_REGISTER.md`
- `docs/LAUNCH_INCIDENT_RESPONSE.md`
- `docs/OPERATOR_PRIVACY_GUIDE.md`
- `docs/OPERATOR_TRIAGE.md`
- `docs/LAUNCH_DECISION_RECORD.md`
- `docs/PRIVACY_POLICY_DRAFT.md`
- `docs/TERMS_OF_SERVICE_DRAFT.md`

The backend scaffold lives in `src/server/publicBackend.ts`. It implements the public API contract without real Google writes yet, including OAuth URL creation and request idempotency.

The deployable Node backend entry point builds with `pnpm build:backend` and starts with `pnpm start:backend`. Hosts
should set `PORT` plus the backend environment variables from `.env.production.example`.

Provider execution is split behind `src/server/actionExecutor.ts`. `src/server/googleExecutor.ts` defines the Google-ready adapter interface for Tasks, Calendar, projects, and waiting records.

Google REST client scaffolding lives in `src/server/googleProviderClients.ts`. It accepts an injected access-token provider and fetch implementation, so real OAuth tokens can be supplied by the backend without putting secrets in the PWA.

OAuth/session flow is scaffolded in `src/server/oauthSession.ts`, including state validation, token exchange interfaces, token storage interfaces, and default workspace creation.

Cookie session handling is in `src/server/sessionStore.ts`. The public backend uses an HttpOnly `bd_session` cookie to associate later requests with the connected user.

The Google OAuth token client lives in `src/server/googleOAuthClient.ts`. It expects the Google client secret from backend configuration, never from frontend source.

`src/server/refreshingTokenProvider.ts` turns stored OAuth tokens into access tokens for provider writes and refreshes them when needed.

`src/server/durableStore.ts` provides the production storage boundary. Deployments can pass a key-value store plus an encryption codec into the backend factory so OAuth tokens and sessions survive restarts without putting secrets in the frontend.

`src/server/supabaseKeyValueStore.ts` provides the first production storage adapter. Set `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` on the backend host to use the Supabase table documented in `docs/SUPABASE_STORAGE.md`.
Set `BRAIN_DUMP_STORAGE_SECRET` so durable values are encrypted before being written.

`src/server/runtimeConfig.ts` and `src/server/runtimeHandler.ts` provide the deployment entry point. A backend host should provide `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BRAIN_DUMP_PUBLIC_API_ORIGIN`, and `BRAIN_DUMP_FRONTEND_ORIGIN`; the handler builds the Google callback URL and sends completed OAuth users back to `/app`.

`src/server/workspaceProvisioning.ts` creates or reuses each public user's own `Brain Dump Work` and `Brain Dump Personal` Google Task lists after sign-in, so public users do not need to provide task-list IDs.

`POST /api/events` stores privacy-safe beta events, and `GET /api/admin/metrics` returns a protected count summary when `BRAIN_DUMP_ADMIN_TOKEN` is configured. Analytics events must not include brain dump text, action titles, or source text.

`GET /api/admin/backup-plan` returns a protected beta backup and restore checklist. Secret-bearing records such as Google refresh tokens should be backed up only through encrypted provider snapshots, not local exports.

`GET /api/admin/readiness` returns a protected launch-readiness report with boolean checks for OAuth config, frontend callback, admin protection, scopes, and durable storage.

`GET /api/admin/launch-summary` returns a protected launch posture summary with event counts, queue counts, and recent error counts for `/operator`.

`GET /api/admin/execution-errors` returns recent protected provider write failures for the `/operator` dashboard.
Add `?format=csv` to export recent failures for support triage.

`POST /api/beta/request` records first-user beta interest without using the founder's Google Sheets. `/operator` reads
those records from protected `GET /api/admin/beta-requests`. Add `?format=csv` to export a follow-up list.

`POST /api/feedback` records structured first-run feedback. `/operator` reads those records from protected
`GET /api/admin/feedback`. Add `?format=csv` to export feedback for user interviews and launch notes.

`POST /api/support/request` records structured support and data-deletion requests. `/operator` reads those records from
protected `GET /api/admin/support-requests`, supports `?format=csv`, and can mark beta, feedback, and support records
through their lifecycle.

CSV exports prefix spreadsheet formula-like cells before download so operator review files do not execute formulas when opened in spreadsheet software.

`src/server/idempotencyStore.ts` keeps processed request IDs from writing twice. When the backend is configured with durable storage, duplicate requests return the original response even after a backend restart.

`src/server/executionLogStore.ts` records each attempted action with request id, user id, status, provider id, and failure messages so the public backend has an audit trail.

## Private Apps Script Adapter

`apps-script/BrainDumpBridge.gs` is retained as a private adapter for Cleveland Stewardship OS. It is not the default public backend.

1. Open the existing Cleveland Stewardship OS Apps Script project.
2. Copy `apps-script/BrainDumpBridge.gs` into that project.
3. Enable the Google Tasks Advanced Service if it is not already enabled.
4. Set script properties as needed:
   - `BRAIN_DUMP_SHARED_SECRET`
   - `CSOS_SPREADSHEET_ID`
   - `CSOS_WORK_TASK_LIST_ID`
   - `CSOS_PERSONAL_TASK_LIST_ID`
   - `CSOS_WORK_CALENDAR_ID`
   - `CSOS_PERSONAL_CALENDAR_ID`
5. Deploy as a Web App that executes as you and is accessible to the intended user.
6. Paste the Web App URL into Brain Dump Settings.

Apps Script CORS can be awkward. This bridge accepts `text/plain` JSON to avoid browser preflight in the private development path. It should not be used as the default backend for public users.

## Migration Note

The bridge is designed to live beside the existing Cleveland Stewardship OS script, not replace it. It writes projects to `Active Projects`, waiting items to `Waiting On`, logs to `CSOS Execution Log`, and uses Google Tasks list IDs from script properties. Keep the existing spreadsheet tabs and Apps Script services enabled, especially the Google Tasks Advanced Service.

## Repository Boundary

This is a standalone repository for `brain-dump-app`. It is not a branch or subfolder of the Providence Timeline repository.
