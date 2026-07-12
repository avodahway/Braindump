# Brain Dump Beta Launch Plan

Brain Dump beta should prove one promise with a small group before we invite the public:

> Get thoughts out of your head, then let Brain Dump turn them into tasks, calendar items, projects, and waiting-on reminders in your own Google account.

## Beta Goal

Validate that non-technical users can:

- Understand what Brain Dump does in under one minute.
- Connect their Google account without founder help.
- Paste or dictate a messy brain dump.
- Trust the preview/output enough to run it.
- Find the created tasks and calendar events afterward.
- Report confusing or wrong routing in a simple way.

## Target Beta Users

Start with 10 to 25 users who already live in Google Calendar or Google Tasks.

Best first users:

- Small business owners.
- Operators or office managers.
- Pastors, nonprofit leaders, coaches, and solo service providers.
- People who already make scattered notes and manually turn them into tasks later.

Avoid first:

- Enterprise IT environments with locked-down OAuth.
- Heavy Gmail automation users.
- People expecting AI to manage email or send messages automatically.

## Beta Offer

Use this positioning during beta:

> Brain Dump turns messy thoughts into organized Google Tasks, Calendar events, projects, and follow-ups. It does not send email, share your data, or touch anyone else's workspace.

## Beta Scope

Included:

- Mock preview mode.
- Public Google OAuth sign-in.
- User-owned `Brain Dump Work` and `Brain Dump Personal` Google Task lists.
- Primary Google Calendar event creation.
- App-owned project and waiting-on records.
- Needs Review for ambiguous or unsafe items.
- Duplicate request protection.
- Execution audit logs.

Excluded for beta:

- Gmail sending.
- Team/shared workspaces.
- Native mobile app store distribution.
- Payment/subscriptions.
- Enterprise admin features.
- Bulk import/export.

## Beta Success Metrics

Track these manually at first:

- Activation: user connects Google and submits one real brain dump.
- First value: user confirms at least one created task/event was correct.
- Trust: user says they would use it again with real work.
- Review confidence: user understands the review step before creating actions.
- Control: user can remove a wrong planned action before creating the rest.
- Safety: vague calendar blocks remain in Needs Review after creation instead of becoming real events.
- Accuracy: percentage of actions routed correctly.
- Review rate: percentage of actions sent to Needs Review.
- Failure rate: provider write errors per request.
- Support load: number of founder interventions per user.

Good beta threshold:

- 70 percent of beta users complete one real run.
- 80 percent of created actions are judged correct or acceptable.
- Fewer than 10 percent of requests need founder intervention.
- No data isolation or duplicate-write incidents.

## Beta Launch Checklist

- Choose a public domain.
- Publish a simple product home page.
- Publish privacy policy and terms pages on the same domain.
- Deploy frontend.
- Deploy backend with durable encrypted storage.
- Configure Google Cloud OAuth consent screen.
- Add test users while app is in Google testing mode.
- Record an OAuth demo video for Google verification.
- Run internal smoke tests.
- Invite first 5 users.
- Review execution logs daily during beta.
- Keep a beta issue log.
- Expand to 10 to 25 users only after the first 5 complete real runs.

## User Onboarding Flow

1. User lands on product page.
2. User opens Brain Dump.
3. User sees mock preview mode first.
4. User connects Google.
5. Brain Dump creates or reuses the user's Brain Dump task lists.
6. User enters a brain dump.
7. Brain Dump shows parsed actions before or after execution, depending on the current UI milestone.
8. User confirms created items in Google Tasks/Calendar.
9. User can disconnect Google.

## Support Process

For beta, support can be founder-led:

- Support email: decide before publishing.
- Frontend support email: set `VITE_SUPPORT_EMAIL` before publishing.
- Response promise: one business day.
- Required support details: user email, approximate time, what they typed if they are comfortable sharing it, expected result, actual result.
- Never ask beta users for Google passwords, tokens, or private calendar screenshots unless they volunteer redacted examples.

## Known Beta Risks

- Google OAuth verification may delay public launch.
- Google Workspace admins may block unverified or sensitive OAuth scopes.
- Parser can misclassify ambiguous items.
- Calendar items without clear date/time should remain Needs Review.
- Durable storage must be encrypted before real public usage.
- Privacy and terms drafts need legal review before broad public marketing.

## Launch Decision

Move from private beta to public beta only when:

- Google OAuth verification path is understood or completed.
- Privacy policy and terms are published.
- Backend storage is durable and encrypted.
- Disconnect flow is tested.
- Disconnect removes stored tokens and workspace connection records.
- Execution logs show no duplicate-write pattern.
- At least 10 beta users complete real workflows.
