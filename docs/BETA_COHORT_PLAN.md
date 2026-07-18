# Brain Dump Beta Cohort Plan

Use this worksheet to choose beta testers, control expansion, and keep feedback comparable across cohorts. Do not commit private tester emails here.

## Cohort Shape

| Cohort | Size | Purpose | Invite Gate | Expansion Gate |
| --- | ---: | --- | --- | --- |
| Founder watched run | 3 to 5 | Validate onboarding and review-before-create language | Production smoke test passes and readiness is green | Every tester completes one real run or a clear blocker is filed |
| Small operator cohort | 10 to 15 | Test repeated weekly use with real work | First cohort has no duplicate-write, data-deletion, or disconnect incidents | At least 70 percent complete a real run and support load is manageable |
| Public beta seed | 25 to 50 | Test self-serve signup and support intake | OAuth verification path is accepted or approved for the intended audience | Queue response times stay under one business day |

## Tester Fit

Good beta testers:

- Use Google Calendar or Google Tasks weekly.
- Already capture scattered notes, texts, voice memos, or paper lists.
- Can describe what Brain Dump got right or wrong after one run.
- Are comfortable using a browser PWA instead of an app-store app.
- Understand that email sending is outside beta scope.

Avoid early testers:

- Need team workspaces, delegated inboxes, or shared calendars to evaluate the product.
- Expect Brain Dump to send emails automatically.
- Cannot use Google OAuth because of employer policy.
- Need enterprise compliance review before basic product testing.

## Invite Tracker Columns

Use these columns in the operator tracker, CRM, or a private spreadsheet:

| Column | Values |
| --- | --- |
| Name | Tester name |
| Email | Private; keep out of committed docs |
| Segment | Small business, nonprofit, church, family admin, solo operator, other |
| Cohort | Founder watched run, Small operator cohort, Public beta seed |
| Google tools | Calendar, Tasks, both, neither |
| Invite status | Not invited, invited, scheduled, active, completed, paused |
| First run status | Not started, connected, previewed, created, blocked |
| Main blocker | OAuth, onboarding, parser, calendar, tasks, support, none |
| Would use again | Yes, maybe, no, not asked |
| Follow-up due | Date |

## Cohort Questions

Ask every tester the same core questions:

- What did you expect Brain Dump to do before you used it?
- Which created task, event, project, or follow-up was most useful?
- Which planned action felt wrong, risky, or confusing?
- Did the review step make you more comfortable creating items in Google?
- Would you use this again next week without help?

## Expansion Gates

Do not expand to the next cohort until:

- `/operator` readiness is green.
- No unresolved duplicate-write, disconnect, or deletion issue is open.
- Recent execution errors are reviewed and either resolved or accepted as known limits.
- Every new support request has a status.
- At least one launch-notes export is saved from `/operator`.
- The launch decision record has a current go/no-go entry.

## Weekly Review

Review these every Friday during beta:

- New beta requests.
- Completed first runs.
- Parser mistakes by category.
- Google write failures.
- Support requests by issue type.
- Tester quotes that explain the product value.
- Highest-friction onboarding step.
- One product fix to ship before inviting the next group.
