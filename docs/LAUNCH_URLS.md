# Brain Dump Launch URLs

Use this inventory when moving from local development to a real beta deployment.

## Required Public Origins

| Item | Production value | Needed before |
| --- | --- | --- |
| Frontend origin | `[BRAIN_DUMP_FRONTEND_ORIGIN]` | Publishing public pages and app |
| Frontend public API build var | `[VITE_PUBLIC_API_BASE_URL]` | Public beta request form |
| Public API origin | `[BRAIN_DUMP_PUBLIC_API_ORIGIN]` | Google OAuth and real writes |
| Support email | `[VITE_SUPPORT_EMAIL]` | Public support, feedback, and beta access |
| Google OAuth redirect URI | `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/auth/google/callback` | OAuth client setup |
| Supabase project URL | `[SUPABASE_URL]` | Durable backend storage |

## Frontend URLs

| URL | Purpose | Must verify |
| --- | --- | --- |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/` | Public product home | Brand, app link, beta links |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/app` | Brain Dump PWA | Preview mode, setup panel, Google connection path |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/privacy` | Privacy policy | Google user data language and support email |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/terms` | Terms of service | Beta status and no automatic email sending |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/support` | Support and account requests | Support email and data request guidance |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/data-deletion` | Data deletion instructions | Disconnect and deletion request process |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/feedback` | Post-run feedback | Three-question feedback form |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/beta` | Beta access request | Public-user expectations and beta request form |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/status` | Launch status | Current beta phase, known limits, and support path |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/faq` | Public FAQ | Google access, review-before-create, email limits, and disconnect answers |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/security` | Security | Password/token guidance, reviewed writes, exports, and concern reporting |
| `[BRAIN_DUMP_FRONTEND_ORIGIN]/operator` | Protected operator dashboard | Admin token loads readiness, metrics, backup plan, beta requests, and recent errors |

The frontend host must serve the same app entry point for every route above.

## Backend URLs

| URL | Purpose | Must verify |
| --- | --- | --- |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/health` | Anonymous uptime check | Returns `ok: true` and `brain-dump-public-backend` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/workspace` | Current session workspace | Returns not connected before OAuth |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/auth/google/start` | Starts Google OAuth | Returns a Google authorization URL |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/auth/google/callback` | OAuth redirect target | Listed in Google OAuth client |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/auth/google/disconnect` | User disconnect | Removes stored session and token records |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/account/delete` | Stored account deletion | Deletes signed-in user's Brain Dump records |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/beta/request` | Public beta access request | Records first-user interest without Google Sheets |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/brain-dump` | Reviewed action execution | Requires connected user session |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/events` | Privacy-safe beta analytics | Stores event metadata only |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/feedback` | Public beta feedback | Records structured first-run feedback |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/support/request` | Public support and data requests | Records support issues and deletion requests |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/metrics` | Protected beta metrics | Requires `X-Brain-Dump-Admin-Token` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/backup-plan` | Protected backup checklist | Requires `X-Brain-Dump-Admin-Token` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/readiness` | Protected launch readiness | Returns `ready: true` only after real config |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/execution-errors` | Protected recent execution errors | Shows recent Google/provider write failures and supports `?format=csv` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/beta-requests` | Protected beta request list | Shows first-user beta access requests and supports `?format=csv` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/feedback` | Protected beta feedback list | Shows first-user feedback submissions and supports `?format=csv` |
| `[BRAIN_DUMP_PUBLIC_API_ORIGIN]/api/admin/support-requests` | Protected support request list | Shows support and data-deletion requests and supports `?format=csv` |

## Verification Command

After both origins are deployed, run:

```sh
BRAIN_DUMP_FRONTEND_ORIGIN=https://braindump.app \
BRAIN_DUMP_PUBLIC_API_ORIGIN=https://api.braindump.app \
BRAIN_DUMP_ADMIN_TOKEN=replace-with-admin-token \
pnpm verify:deployment
```

The admin token can be omitted if you only want to verify public pages, health, and anonymous admin rejection. Include it
to verify readiness, metrics, backup, execution errors, beta requests, feedback, and CSV exports.

## Missing Values To Collect

- Production frontend URL.
- Production backend URL.
- Support email.
- Google OAuth client ID.
- Google OAuth client secret.
- Supabase URL.
- Supabase service role key.
- Supabase `brain_dump_kv` table.
- Long random storage encryption secret.
- Long random admin token.
- Public beta request intake URL.
- First OAuth test-user email addresses.
