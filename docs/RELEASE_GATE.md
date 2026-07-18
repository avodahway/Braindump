# Brain Dump Release Gate

Use this before promoting a build to beta testers.

## Required Green Checks

- GitHub Actions `CI` workflow passes on `main`.
- Local `pnpm test` passes.
- Local `pnpm build` passes.
- Local `pnpm build:backend` passes.
- `pnpm verify:deployment` passes against the deployed frontend and backend.
- `/api/admin/readiness` returns `ready: true` with the admin token, durable storage, and storage encryption configured.

## What CI Covers

The GitHub Actions workflow runs on every pull request and every push to `main`.

It verifies:

- Dependencies install from the committed lockfile.
- Parser, routing, backend contract, OAuth/session, analytics, and readiness tests pass.
- The production PWA build completes.
- The deployable Node backend build completes.

## What CI Does Not Cover

CI does not use real Google credentials, create Google Tasks, create Google Calendar events, or verify deployed URLs.

Those checks stay in the deployment smoke test because they require:

- Production frontend URL.
- Production backend URL.
- Google OAuth client.
- OAuth test-user account.
- Durable encrypted storage.
- Admin token.

## Beta Promotion Rule

Do not invite the next tester batch unless:

- CI is green.
- Deployment verification is green.
- Operator privacy guidance has been reviewed for this batch.
- A launch decision record exists for the current tester batch or release.
- The last tester batch has no unresolved duplicate-write, disconnect, OAuth, or wrong-calendar issues.
