# Launch Incident Response

Brain Dump can invite public users only if incidents are handled quickly, calmly, and with a clear stop rule. This runbook covers the first public beta and the move from private founder use to multi-user launch.

## Severity Levels

| Level | Meaning | First Response Target | Owner Action |
| --- | --- | --- | --- |
| Critical | Data deletion, disconnect, account access, duplicate writes, or OAuth callback failures affecting multiple users. | 1 hour | Pause new invites and post a status update. |
| High | One user blocked from connecting, creating reviewed actions, or receiving support. | 4 hours | Acknowledge, investigate, and update the support record. |
| Medium | Confusing output, isolated parser miss, unclear onboarding, or non-blocking UI issue. | 1 business day | Triage with feedback and batch into product fixes. |
| Low | Copy polish, cosmetic issue, or non-urgent launch asset update. | 3 business days | Add to launch backlog. |

## Stop-The-Line Triggers

Pause new invites immediately when any of these are true:

- Users cannot disconnect Google.
- Users cannot request account data deletion.
- Google OAuth succeeds but workspaces are created for the wrong user.
- Duplicate Google writes appear in the protected duplicate-write audit.
- Support SLA shows overdue Critical or High requests.
- Durable storage is unavailable, unencrypted, or losing session/token records.
- Analytics privacy audit fails or private brain-dump text appears in telemetry.

## First 15 Minutes

1. Open `/operator` and refresh metrics, self-test, duplicate-write audit, support SLA, and beta cohort readiness.
2. Stop inviting new beta users if any stop-the-line trigger is present.
3. Capture the affected request ID, user email if supplied through support, timestamp, route, and browser/device notes.
4. Check whether the issue is public frontend, public backend, Google OAuth, Google provider write, storage, or support queue.
5. Create or update the support request with severity and next action.

## OAuth Or Connection Incident

1. Check `GET /api/admin/readiness` for Google client ID, redirect URI, scopes, frontend return URL, admin token, durable storage, and encryption.
2. Check `GET /api/admin/self-test` for backend runtime configuration.
3. Run the OAuth smoke test against production when a deployment URL exists.
4. Confirm the Google OAuth consent app redirect URI exactly matches the backend callback URL.
5. Tell affected users not to retry repeatedly if callbacks are failing; retries can create noisy support data.

Resolution rule: resume invites only after a successful OAuth smoke test and one manual connect/disconnect cycle.

## Duplicate Write Incident

1. Open `/operator` and review the duplicate-write audit panel.
2. Export recent execution errors and identify request IDs tied to duplicate provider IDs.
3. Do not delete user-created Google Tasks or Calendar events automatically.
4. Ask affected users which duplicate item they prefer to keep.
5. Add a regression test before resuming invites.

Resolution rule: duplicate-write audit must return `ok: true` before the next cohort.

## Data Deletion Or Disconnect Incident

1. Treat every disconnect or deletion failure as Critical.
2. Confirm whether the user has an active session.
3. Retry only after identifying whether the failure is session, token store, execution log, analytics, or provider state.
4. Record which data classes were deleted: Google tokens, workspace, session, idempotency responses, execution logs, analytics events.
5. Send a plain-language confirmation after deletion succeeds.

Resolution rule: no new invites until deletion and disconnect both pass in production.

## Support Overload Incident

1. Check support SLA and beta cohort readiness.
2. Stop sending invites when support SLA has overdue requests or more than 10 open requests.
3. Answer Google connection and data deletion issues first.
4. Move confusing-output reports into feedback unless the user is blocked.
5. Resume with a smaller cohort size when SLA is back inside the threshold.

Resolution rule: support SLA must show zero overdue requests.

## Communications

Use clear, non-technical language:

- We paused new invites while we fix an issue.
- Your existing Google account remains yours; Brain Dump cannot read your whole account.
- We are checking connection, deletion, and duplicate-write safety before inviting more people.
- We will confirm once the fix has passed the production checks.

## Closeout Checklist

- Incident severity recorded.
- Affected users acknowledged.
- Root cause captured in the launch decision record or risk register.
- Regression test or deployment check added when possible.
- Support SLA is clear.
- Beta cohort readiness recommends a nonzero next cohort size.
- New invites are resumed deliberately, not automatically.
