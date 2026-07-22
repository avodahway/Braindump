# Launch Decision Record

Use one copy of this record for each beta batch or public launch decision.

## Decision

- Date:
- Decision owner:
- Decision: Go / No-go / Hold
- Target release or tester batch:

## Required Evidence

- `pnpm test`:
- `pnpm build`:
- `pnpm build:backend`:
- `pnpm verify:deployment`:
- `/api/admin/readiness` result:
- `/operator` queue review:
- Support and data deletion request review:

## Blockers

List every unresolved launch blocker. Include owner and next action.

| Blocker | Owner | Next action | Due |
| --- | --- | --- | --- |
|  |  |  |  |

## Risk Notes

- Google OAuth status:
- Durable storage status:
- Storage encryption status:
- Beta access control status:
- Privacy/support readiness:

## Approval Notes

Record the exact scope approved. Examples: first 5 beta testers, next 20 invited users, public waitlist only, or no external users.

## Follow-up

- Update `/status` copy if the launch phase changes.
- Archive stale CSV exports after the batch is closed.
- Mark beta, feedback, and support records in `/operator`.
- Add the next decision record before expanding the tester pool.
