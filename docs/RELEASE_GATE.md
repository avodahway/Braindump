# Brain Dump Release Gate

Use this before promoting a build to beta testers.

## Required Green Checks

- GitHub Actions `CI` workflow passes on `main`.
- Local `pnpm test` passes.
- Local `pnpm build` passes.
- Local `pnpm build:backend` passes.
- Local `pnpm audit:analytics` passes.
- `pnpm verify:deployment` passes against the deployed frontend and backend.
- `pnpm rehearse:restore` passes against the protected deployed backend backup plan.
- `docs/DEPLOYMENT_SMOKE_TEST.md` is completed for the target environment.
- `/api/admin/readiness` returns `ready: true` with the admin token, durable storage, and storage encryption configured.
- `/api/admin/duplicate-write-audit` returns no duplicate groups before expanding the beta cohort.
- `/api/admin/support-sla` returns zero overdue support requests.
- `/api/admin/beta-cohort-readiness` recommends a nonzero next cohort size.

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
- The launch incident response runbook has been reviewed for this batch.
- A launch decision record exists for the current tester batch or release.
- `/operator` go/no-go summary has been exported and attached to the launch decision record.
- The last tester batch has no unresolved duplicate-write, disconnect, OAuth, or wrong-calendar issues.
- The duplicate-write audit is clear or every group has been manually explained and recorded in the launch decision record.
