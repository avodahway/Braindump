# Brain Dump Hosting Decision

Updated: 2026-07-14

This document narrows the first public beta hosting choice. It is intentionally practical: pick boring infrastructure,
keep secrets server-side, and avoid building a custom platform before the first users prove the product.

## Recommended Beta Stack

| Layer | Recommendation | Why |
| --- | --- | --- |
| Frontend PWA | Vercel static deployment | Simple GitHub deploys, custom domain, automatic HTTPS, rollback, good fit for a Vite PWA. |
| Public backend | Render Web Service, Starter tier or higher | Runs a normal Node HTTP service, supports environment variables, custom domains, health checks, logs, and paid always-on instances. |
| Durable storage | Supabase Pro Postgres | Managed Postgres, daily backups on Pro, enough structure for sessions, OAuth tokens, idempotency, execution logs, and analytics. |
| Secrets | Hosting provider env vars plus password manager | Keeps Google client secret and admin token out of Git and out of the frontend bundle. |

This stack keeps the app understandable:

- Vercel serves the React PWA.
- Render runs the public API.
- Supabase stores encrypted app records.
- Google remains the user's task/calendar provider.

## Why Not Use Apps Script For Public Beta

The Apps Script bridge remains useful for private Cleveland Stewardship OS compatibility, but it is not the right public
backend for unrelated users. Public beta needs per-user Google OAuth, token storage, disconnect/delete flows, idempotency,
execution logs, and support diagnostics that are easier to operate in a normal backend.

## Current Cost Notes

Always confirm pricing before purchase.

- Vercel lists a free Hobby plan and a Pro plan at `$20/mo` on its pricing page.
- Render lists Hobby workspace at `$0/mo + compute`, web services with a free instance, and Starter web service pricing at `$7/mo`.
- Supabase lists a Free plan and a Pro plan at `$25/mo`; Pro includes daily backups and more production-friendly limits.

Sources:

- https://vercel.com/pricing
- https://render.com/pricing
- https://supabase.com/pricing

## Minimum Beta Purchase

For a real private beta, avoid free tiers for anything that holds user data or must stay awake.

Recommended starting point:

- Vercel Hobby or Pro for frontend, depending on account/team needs.
- Render Starter web service for backend.
- Supabase Pro for storage because backups matter once user OAuth tokens and execution logs exist.

Expected baseline platform spend before domains and usage overages: roughly `$32/mo` if Vercel Hobby is enough, or roughly
`$52/mo` if Vercel Pro is needed.

## Decision Criteria

Choose the final providers using these criteria:

- Supports custom domain and HTTPS.
- Supports environment variables and secret rotation.
- Supports rollback.
- Provides logs useful enough for beta support.
- Provides backup or restore for records that affect users.
- Can run `pnpm verify:deployment` successfully.
- Keeps `GOOGLE_CLIENT_SECRET`, refresh tokens, and `BRAIN_DUMP_ADMIN_TOKEN` outside the frontend.

## Required Production Values

After choosing providers, fill these values in `docs/LAUNCH_URLS.md` and host secret settings:

- `BRAIN_DUMP_FRONTEND_ORIGIN`
- `BRAIN_DUMP_PUBLIC_API_ORIGIN`
- `VITE_SUPPORT_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `BRAIN_DUMP_ADMIN_TOKEN`
- Durable storage connection settings

## Decision To Make Later

Before deployment, choose:

1. Frontend host.
2. Backend host.
3. Durable storage provider.
4. Production domain.
5. Support email.

No Google OAuth credentials are needed to keep developing locally. They are needed when deploying real public sign-in.
