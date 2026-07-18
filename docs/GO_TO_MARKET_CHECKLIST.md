# Brain Dump Go-To-Market Checklist

## Phase 1: Private Beta Foundation

- Decide support email.
- Set `VITE_SUPPORT_EMAIL` for the public frontend build.
- Decide product domain.
- Review `docs/HOSTING_DECISION.md`.
- Publish basic home page.
- Publish privacy policy draft page.
- Publish terms draft page.
- Confirm `/`, `/privacy`, `/terms`, `/support`, `/data-deletion`, `/feedback`, `/beta`, `/status`, `/operator`, and `/app` routes work on the deployed frontend.
- Confirm `/app` explains setup progress, demo mode, Google connection, destinations, and disconnect.
- Confirm `/app` first-run samples load and review successfully.
- Confirm `/operator` loads readiness, metrics, backup status, and checklist with the admin token.
- Pick frontend host.
- Pick backend host.
- Pick durable encrypted storage.
- Review `docs/PRODUCTION_DEPLOYMENT.md`, `vercel.json`, and `render.yaml`.
- Fill launch URL inventory from `docs/LAUNCH_URLS.md`.
- Fill production env template from `.env.production.example` in host secret settings.
- Deploy staging frontend.
- Deploy staging backend.
- Confirm GitHub Actions CI passes on `main`.
- Confirm `GET /api/health` responds on staging.
- Run `pnpm verify:deployment` against staging.
- Review `docs/RELEASE_GATE.md` before inviting testers.
- Configure Google OAuth testing app.
- Add first test users.
- Run end-to-end Google OAuth smoke test.
- Prepare first-user beta packet.
- Prepare beta launch worksheet with URL, support email, OAuth test users, and admin-token checks.

## Phase 2: First Five Users

- Invite 5 known users.
- Send first-user beta packet invite.
- Review `docs/OPERATOR_PRIVACY_GUIDE.md` before exporting beta, feedback, or support CSVs.
- Complete `docs/LAUNCH_DECISION_RECORD.md` before expanding beyond the current beta batch.
- Watch every first-run session if possible.
- Record where onboarding confuses them.
- Track parser mistakes.
- Track write failures.
- Confirm tasks appear in the correct Google Task lists.
- Confirm calendar events appear on the user's primary calendar.
- Confirm Disconnect Google works.

## Phase 3: Beta Expansion

- Fix top onboarding issues.
- Add feedback/support link inside app.
- Add clear output review UI if not already present.
- Confirm review-before-create is understandable to beta users.
- Confirm users understand they can remove wrong preview actions before creating.
- Confirm vague calendar items stay in Needs Review and do not create Google Calendar events.
- Add user-facing error messages for OAuth and provider failures.
- Confirm failed Google writes keep reviewed actions available and show Retry/support options.
- Invite 10 to 25 users.
- Prepare OAuth verification submission.

## Phase 4: Public Beta

- Complete or submit OAuth verification.
- Move OAuth app from testing when ready.
- Publish production privacy policy and terms.
- Add lightweight analytics that do not capture brain dump content.
- Confirm analytics stores only event names, request IDs, counts, summaries, and timestamps.
- Protect `/api/admin/metrics` with `BRAIN_DUMP_ADMIN_TOKEN`.
- Add backup/export plan for user records.
- Protect `/api/admin/backup-plan` with `BRAIN_DUMP_ADMIN_TOKEN`.
- Test encrypted storage snapshot restore in staging.
- Confirm `/api/admin/readiness` returns `ready: true`.
- Announce public beta to a narrow audience.

## Pricing Hypotheses

Keep pricing out of the first private beta. After validation, test:

- Free preview mode.
- Paid connected Google execution.
- Monthly solo plan.
- Future small-team plan.

## Messaging Tests

Test these value propositions:

- "Get it out. We'll handle the rest."
- "Turn messy thoughts into tasks and calendar blocks."
- "Stop sorting your thoughts before you capture them."
- "Brain dump once. Leave with a plan."

## Launch Assets Needed

- Product home page.
- App screenshots.
- Short demo video.
- OAuth verification demo video.
- Privacy policy.
- Terms of service.
- Support email.
- Founder beta invitation email.
- 3-question post-run feedback form at `/feedback`.
- Beta access request page at `/beta`.
- Protected beta request list in `/operator`.
- Protected beta feedback list in `/operator`.
- CSV exports for beta requests and feedback.
- CSV exports for beta requests, feedback, and support requests.
- Support and data-deletion request intake through `/support` and `/data-deletion`.
- Operator lifecycle actions for beta requests, feedback, and support requests.
- Public launch status page at `/status`.
- Launch decision record.
