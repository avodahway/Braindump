# Brain Dump Production Deployment

Use this guide to deploy the first controlled public beta with Vercel, Render, and Supabase.

## 1. Production Hosts

Recommended hosts:

- Frontend PWA: Vercel, using `vercel.json`.
- Public API: Render Web Service, using `render.yaml`.
- Durable storage: Supabase, using `docs/SUPABASE_STORAGE.md`.

Do not put backend secrets in Vercel. Vercel only needs frontend build variables.

## 2. Frontend Variables

Set these in Vercel:

| Variable | Example |
| --- | --- |
| `VITE_SUPPORT_EMAIL` | `support@braindump.app` |

Vercel settings:

- Build command: `pnpm build`
- Output directory: `dist`
- SPA routing: handled by `vercel.json`

## 3. Backend Variables

Set these in Render:

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | Google Web OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Web OAuth client secret |
| `BRAIN_DUMP_PUBLIC_API_ORIGIN` | Yes | Render backend origin, no trailing slash |
| `BRAIN_DUMP_FRONTEND_ORIGIN` | Yes | Vercel frontend origin, no trailing slash |
| `BRAIN_DUMP_ADMIN_TOKEN` | Yes | Long random operator token |
| `BRAIN_DUMP_STORAGE_SECRET` | Yes | Long random encryption secret |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side only |
| `BRAIN_DUMP_BETA_ACCESS_CODE` | Recommended | Keeps first public beta invite-only |
| `BRAIN_DUMP_STORAGE_PREFIX` | Recommended | Use `brain-dump-prod` |
| `SUPABASE_KV_TABLE` | Recommended | Use `brain_dump_kv` |
| `GOOGLE_OAUTH_SCOPES` | Recommended | Tasks and Calendar scopes |
| `BRAIN_DUMP_MAX_JSON_BODY_BYTES` | Optional | Default `65536` |
| `BRAIN_DUMP_RATE_LIMIT_WINDOW_MS` | Optional | Default `60000` |
| `BRAIN_DUMP_RATE_LIMIT_MAX_REQUESTS` | Optional | Default `60` |

Render settings:

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build:backend`
- Start command: `pnpm start:backend`
- Health check path: `/api/health`
- Auto deploy: off until the release gate is established

## 4. Google OAuth

Create a Google Web OAuth client with this redirect URI:

```text
[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/auth/google/callback
```

The frontend return URL is configured through `BRAIN_DUMP_FRONTEND_ORIGIN`; successful OAuth returns users to `/app`.

For invite-only beta, keep the OAuth app in testing mode and add test users. For open public access, plan for OAuth verification before promoting widely.

## 5. Supabase

1. Create the `brain_dump_kv` table from `docs/SUPABASE_STORAGE.md`.
2. Put the Supabase service role key only in Render.
3. Set `BRAIN_DUMP_STORAGE_SECRET` before any real user connects Google.
4. Confirm `/api/admin/readiness` reports durable encrypted storage as ready.

## 6. Release Gate

Before inviting users:

```sh
pnpm test
pnpm build
pnpm build:backend
```

Then verify the deployed stack. With an admin token, this checks public pages, `/operator`, backend health, protected
operator feeds, and CSV exports:

```sh
BRAIN_DUMP_FRONTEND_ORIGIN=https://braindump.app \
BRAIN_DUMP_PUBLIC_API_ORIGIN=https://api.braindump.app \
BRAIN_DUMP_ADMIN_TOKEN=replace-with-admin-token \
pnpm verify:deployment
```

Open `/operator` on the deployed frontend and confirm readiness, metrics, backup status, beta requests, feedback, recent
errors, CSV exports, and the checklist load with the admin token.

## 7. First Invite

For the first real user:

1. Keep `BRAIN_DUMP_BETA_ACCESS_CODE` enabled.
2. Send the user the beta access code separately from the app URL.
3. Watch the first Google connect and first create flow if possible.
4. Confirm tasks/calendar writes land in the user's Google account.
5. Confirm Disconnect and Delete account data work.
