# Operator Privacy Guide

Use this guide when reviewing beta requests, feedback, support requests, CSV exports, and launch readiness data.

## Working Rules

- Use the minimum record needed to solve the user request.
- Do not ask for Google passwords, OAuth tokens, recovery codes, or unredacted private calendar screenshots.
- Keep exported CSVs local to the launch workflow and delete stale copies after the issue or tester batch is closed.
- Do not paste full brain dump text into public channels, issue trackers, or marketing notes.
- Summarize user feedback without exposing private names, emails, calendar details, or task contents unless the user explicitly approved that use.
- Treat data deletion requests as support-priority records until they are resolved or archived.
- Mark beta, feedback, and support lifecycle status in `/operator` after each action so the queue stays reviewable.

## Safe Copy

Use user-facing language that says what happened and what to do next. Avoid internal storage names, raw IDs, tokens, stack traces, or provider error payloads unless the user needs a request ID for support.

## CSV Handling

CSV exports are for short-lived operator work: tester invitation batches, feedback review, and support follow-up. Do not attach them to broad email threads or shared docs.

## Escalation

Pause and review manually when a request includes health, legal, financial, child-related, credential, or highly personal information. Brain Dump should help the user route tasks, not become the place sensitive records are casually redistributed.
