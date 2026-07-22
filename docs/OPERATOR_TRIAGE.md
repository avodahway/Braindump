# Operator Triage

Use this guide when beta users submit support requests, feedback, or execution errors.

## Severity

| Severity | Meaning | Examples | Response target |
| --- | --- | --- | --- |
| Critical | User cannot safely use or disconnect Brain Dump | OAuth loop, disconnect fails, deletion request blocked, duplicate writes | Same day |
| High | Core promise failed for a connected user | Task/calendar write failure, wrong calendar, confusing review flow causing bad create | 1 business day |
| Medium | Beta friction without data risk | Unclear copy, sample confusion, missing expectation, support form issue | 2-3 business days |
| Low | Nice-to-have or future feature | New integration request, cosmetic polish, pricing question | Next review batch |

## Categories

- OAuth/connect
- Task write
- Calendar write
- Parser/routing
- Review UI
- Support/data request
- Feedback/onboarding
- Documentation

## Triage Steps

1. Check `/operator` readiness and recent execution errors.
2. Export the relevant CSV only if needed for short-lived support work.
3. Match the issue to a severity and category.
4. Record the next action, owner, and whether the user needs a reply.
5. Mark the support, feedback, or beta record lifecycle state in `/operator`.
6. Update launch blockers if the issue should stop the next tester batch.

## Stop-The-Line Issues

Do not invite more testers until these are resolved:

- Users cannot disconnect Google.
- Data deletion requests cannot be received or tracked.
- The app creates duplicate tasks or calendar events from one approved request.
- Calendar events are created on the wrong account or without user review.
- OAuth tokens, private brain dump text, or exported CSVs are exposed outside the operator workflow.
