# Brain Dump Go-To-Market Checklist

## Phase 1: Private Beta Foundation

- Decide support email.
- Set `VITE_SUPPORT_EMAIL` for the public frontend build.
- Decide product domain.
- Review `docs/HOSTING_DECISION.md`.
- Publish basic home page.
- Publish privacy policy draft page.
- Publish terms draft page.
- Confirm `/`, `/privacy`, `/terms`, `/support`, `/data-deletion`, `/feedback`, `/beta`, `/status`, `/faq`, `/security`, `/install`, `/roadmap`, `/press`, `/examples`, `/pricing`, `/demo`, `/operator`, and `/app` routes work on the deployed frontend.
- Confirm `/robots.txt`, `/sitemap.xml`, and public metadata checks pass in deployment verification.
- Confirm Vercel security headers are present from `vercel.json`.
- Confirm `/app` explains setup progress, demo mode, Google connection, destinations, and disconnect.
- Confirm `/app` first-run samples load and review successfully.
- Confirm `/operator` loads readiness, launch summary, metrics, backup status, and checklist with the admin token.
- Pick frontend host.
- Pick backend host.
- Pick durable encrypted storage.
- Review `docs/PRODUCTION_DEPLOYMENT.md`, `vercel.json`, and `render.yaml`.
- Fill launch URL inventory from `docs/LAUNCH_URLS.md`.
- Fill production env template from `.env.production.example` in host secret settings.
- Run `pnpm validate:env` in a shell with production env values available.
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
- Prepare launch announcement copy from `docs/LAUNCH_ANNOUNCEMENT_KIT.md`.
- Prepare screenshots and demo clips from `docs/LAUNCH_ASSET_CHECKLIST.md`.
- Prepare beta launch worksheet with URL, support email, OAuth test users, and admin-token checks.

## Phase 2: First Five Users

- Invite 5 known users.
- Send first-user beta packet invite.
- Review `docs/OPERATOR_PRIVACY_GUIDE.md` before exporting beta, feedback, or support CSVs.
- Use `docs/OPERATOR_TRIAGE.md` to classify support, feedback, and execution-error reports.
- Use `docs/BETA_COHORT_PLAN.md` to select testers, track cohort fit, and decide when to expand.
- Review `docs/LAUNCH_RISK_REGISTER.md` before each invite batch.
- Complete `docs/LAUNCH_DECISION_RECORD.md` before expanding beyond the current beta batch.
- Watch every first-run session if possible.
- Use `docs/BETA_USER_INTERVIEW_GUIDE.md` for watched runs and follow-up calls.
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
- Fill `docs/OAUTH_VERIFICATION_ASSETS.md` before submitting OAuth verification.

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
- Confirm `/api/admin/launch-summary` returns protected launch posture and queue counts.
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
- Public FAQ at `/faq`.
- Public security page at `/security`.
- Public install help at `/install`.
- Public roadmap page at `/roadmap`.
- Public press page at `/press`.
- Public examples page at `/examples`.
- Public pricing page at `/pricing`.
- Public demo page at `/demo`.
- Support email.
- Founder beta invitation email.
- Launch announcement kit.
- Launch asset checklist.
- Founder beta follow-up email.
- Beta user interview guide.
- 3-question post-run feedback form at `/feedback`.
- Beta access request page at `/beta`.
- Protected beta request list in `/operator`.
- Protected beta request status filter in `/operator`.
- Protected beta feedback list in `/operator`.
- Protected feedback and support status filters in `/operator`.
- CSV exports for execution errors, beta requests, feedback, and support requests.
- Support and data-deletion request intake through `/support` and `/data-deletion`.
- Operator lifecycle actions for beta requests, feedback, and support requests.
- Operator launch summary and launch-notes export.
- Operator privacy and triage guides.
- Beta cohort plan.
- Launch risk register.
- Production env validator.
- Production security headers.
- Deployment smoke-test worksheet.
- OAuth verification assets worksheet.
- Public launch status page at `/status`.
- Launch decision record.
