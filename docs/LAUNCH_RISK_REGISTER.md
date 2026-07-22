# Brain Dump Launch Risk Register

Use this register before each beta expansion decision. Keep the live copy in the operator tracker or private planning
space; this committed version defines the categories and default response.

| Risk | Trigger | Severity | Owner | Mitigation | Go/No-Go Rule |
| --- | --- | --- | --- | --- | --- |
| OAuth verification delay | Google app cannot move beyond testing mode for intended audience | High | Founder | Keep cohorts inside approved test users and prepare verification assets | No broad public beta until the audience can connect Google |
| Duplicate Google writes | A retry or refresh creates the same task/event more than once | Critical | Engineering | Review idempotency logs and pause invites | No expansion while a duplicate-write pattern is unresolved |
| Disconnect or deletion failure | User cannot disconnect Google or delete stored account data | Critical | Engineering | Verify `/api/auth/google/disconnect` and `/api/account/delete` in staging and production | No invites until fixed |
| Unencrypted durable storage | `BRAIN_DUMP_STORAGE_SECRET` is missing or readiness is blocked | Critical | Engineering | Set storage secret and confirm `/api/admin/readiness` is green | No real user OAuth tokens without encryption |
| Parser trust gap | Users do not understand why items went to Tasks, Calendar, Projects, Waiting, or Review | Medium | Product | Add examples, improve copy, and review top parser mistakes weekly | Do not expand if first-run confidence falls below 70 percent |
| Support queue overload | New or in-progress support requests exceed one business day response | High | Founder | Pause invites, filter queues in `/operator`, resolve critical issues first | No next cohort until support queue is under control |
| Public-page mismatch | Privacy, terms, status, roadmap, or press pages overpromise beta behavior | Medium | Product | Run launch-doc review before announcements | No announcement until public pages match current beta scope |
| Host instability | Frontend, backend, or storage host has recurring downtime during testing | High | Engineering | Run deployment verification and check host logs before each cohort | No expansion after unexplained downtime |

## Weekly Review

- Export launch notes from `/operator`.
- Review `/api/admin/launch-summary`.
- Review new beta requests by status.
- Update each risk as Green, Watch, Blocked, or Accepted.
- Record the expansion decision in `docs/LAUNCH_DECISION_RECORD.md`.

## Escalation

Pause new invites immediately for critical risks involving Google account access, duplicate writes, data deletion,
disconnect failure, token storage, or accidental exposure of private user data.
