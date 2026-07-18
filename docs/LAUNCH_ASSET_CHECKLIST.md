# Brain Dump Launch Asset Checklist

Use this before public beta announcements, OAuth verification submission, investor/advisor demos, or directory listings.

## Required Screenshots

- Home page first viewport with Brain Dump name, tagline, and public beta path.
- App capture screen in mock preview mode.
- Review-before-create screen with calendar, task, project, waiting, and Needs Review groups visible.
- Connected Google workspace state using a dedicated test account.
- Successful created result with feedback link visible.
- Operator dashboard with readiness, production launch tracker, duplicate-write audit, and queue summaries visible.
- Support page and data deletion page.

## Demo Clips

- 30-second product loop: paste messy thoughts, review routed actions, remove one action, create.
- 90-second founder walkthrough: problem, review-before-create, Google connection, disconnect, support path.
- OAuth verification recording: use `/oauth-demo-checklist` and a dedicated Google test user.

## Brand Assets

- `public/icons/brain-dump-icon-180.png`
- `public/icons/brain-dump-icon-512.png`
- `docs/brand-reference.png`
- Plain text tagline: `Get it out. We'll handle the rest.`
- Short product description from `docs/LAUNCH_ANNOUNCEMENT_KIT.md`.

## Proof Points To Capture

- Nothing is created before the review step.
- Ambiguous calendar items stay in Needs Review.
- Google connection belongs to the current user.
- Disconnect Google and Delete account data are visible.
- Support, feedback, privacy, terms, security, and launch status are reachable from public pages.

## Do Not Capture

- Real personal Google Calendar details.
- Real private task lists.
- OAuth tokens, browser cookies, admin tokens, host env vars, Supabase keys, or backend logs containing private data.
- Private user-submitted brain dump text.

## File Naming

- `brain-dump-home-desktop.png`
- `brain-dump-app-review-mobile.png`
- `brain-dump-connected-workspace.png`
- `brain-dump-oauth-verification-demo.mp4`
- `brain-dump-founder-walkthrough.mp4`
