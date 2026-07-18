# Deployment Smoke Test

Use this worksheet after deploying staging or production. Automated deployment verification is required, but this catches human workflow issues.

## Environment

- Date:
- Tester:
- Frontend URL:
- Public API URL:
- Build or commit:
- Environment: Staging / Production

## Automated Checks

- `pnpm test`:
- `pnpm build`:
- `pnpm build:backend`:
- `pnpm verify:deployment`:

## Public Pages

| Route | Expected | Result | Notes |
| --- | --- | --- | --- |
| `/` | Home page loads and links to app, beta, privacy, support |  |  |
| `/app` | Preview mode loads with first-run samples |  |  |
| `/privacy` | Google user data language is present |  |  |
| `/terms` | Beta status and no-email language is present |  |  |
| `/support` | Support form or fallback email is available |  |  |
| `/data-deletion` | Deletion request path is clear |  |  |
| `/feedback` | Three-question feedback form is available |  |  |
| `/beta` | Beta access form is available |  |  |
| `/status` | Current launch phase and limits are accurate |  |  |
| `/faq` | Google access, review-before-create, email limits, and disconnect answers are present |  |  |
| `/security` | Password, token, reviewed-write, and export guidance is present |  |  |
| `/install` | PWA install guidance is present |  |  |
| `/roadmap` | Beta scope, next work, later work, and out-of-scope features are present |  |  |
| `/press` | Approved beta description, boundaries, assets, and contact are present |  |  |
| `/examples` | Task, calendar, project, follow-up, and review examples are present |  |  |
| `/pricing` | Beta pricing expectations and no-surprise-charge language are present |  |  |
| `/demo` | Walkthrough script and safety points are present |  |  |
| `/operator` | Requires production API URL and admin token |  |  |

## Search And Share

| Asset | Expected | Result | Notes |
| --- | --- | --- | --- |
| `/` metadata | Description, Open Graph, Twitter card, and canonical tags are present |  |  |
| `/robots.txt` | Allows public routes and disallows `/operator` |  |  |
| `/sitemap.xml` | Includes public launch pages and excludes `/operator` |  |  |

## App Workflow

- Load a first-run sample.
- Review the sample.
- Remove one preview action.
- Confirm no Google write happens before Create.
- In public mode, connect Google with a test user.
- Confirm tasks appear in the user's own Brain Dump task lists.
- Confirm calendar events appear on the user's calendar.
- Disconnect Google.
- Submit feedback.
- Submit support request.
- Submit data deletion request.

## Operator Workflow

- Load `/operator` with admin token.
- Confirm readiness grouping shows blockers and ready checks.
- Confirm Launch Summary shows posture, recent errors, open beta, and open support.
- Export launch notes Markdown.
- Filter beta requests by status before exporting a waitlist batch.
- Filter feedback and support requests by status before exporting review batches.
- Export execution errors CSV.
- Export beta requests CSV.
- Export feedback CSV.
- Export support requests CSV.
- Mark one beta request invited.
- Mark one feedback record reviewed.
- Mark one support request in progress or resolved.

## Blockers

| Blocker | Severity | Owner | Next action |
| --- | --- | --- | --- |
|  |  |  |  |
