# Brain Dump First-User Beta Packet

Use this packet for the first 5 invited testers. Keep the first round small, watched, and practical.

Use `docs/BETA_LAUNCH_WORKSHEET.md` for deployment-specific URLs, support email, OAuth test users, and launch-day checks.

## Founder Prep Checklist

- Deploy the frontend and backend to staging or beta production.
- Set `VITE_SUPPORT_EMAIL`, `BRAIN_DUMP_FRONTEND_ORIGIN`, `BRAIN_DUMP_PUBLIC_API_ORIGIN`, and `BRAIN_DUMP_ADMIN_TOKEN`.
- Confirm `/`, `/privacy`, `/terms`, `/support`, `/data-deletion`, `/feedback`, `/beta`, and `/app` load on the beta domain.
- Confirm `/status` and `/faq` match the current beta posture.
- Confirm Google OAuth works with one test account.
- Confirm `GET /api/admin/metrics` and `GET /api/admin/backup-plan` require `X-Brain-Dump-Admin-Token`.
- Confirm backup snapshot or point-in-time recovery is available before inviting testers.
- Add each invited tester as a Google OAuth test user while the app is in testing mode.
- Prepare one support thread per tester with their name, email, invite date, and first-run notes.

## Invitation Email

Subject: Want to try Brain Dump with me?

Hi [Name],

I am opening a very small beta for Brain Dump, a tool that turns a messy note into Google Tasks, calendar items, projects, and follow-ups.

The promise is simple: get it out, and Brain Dump will help organize the rest.

What I need from you:

- Try it with one real messy brain dump.
- Review what it plans before creating anything.
- Tell me what felt right, wrong, confusing, or useful.

A few important notes:

- Brain Dump will ask to connect your Google account so it can create tasks and calendar events you approve.
- It does not send email.
- It does not touch anyone else's workspace.
- You can disconnect Google from inside the app.
- This is beta software, so please review anything it creates.

Beta link: [BETA_APP_URL]

Beta request page: [BETA_APP_URL]/beta

If you are willing, try it this week and send me your honest notes.

Thank you,

[Your Name]

## Tester Instructions

1. Open [BETA_APP_URL].
2. Read the home page, privacy page, and terms if you want the full context.
3. Open the app.
4. Click Connect Google.
5. Approve the Google consent screen.
6. Paste or dictate one messy note with a few tasks, one clear calendar item, and one follow-up.
7. Click Review.
8. Remove anything that looks wrong.
9. Click Create.
10. Check Google Tasks and Google Calendar.
11. Send feedback using the app link, `/feedback`, or reply to the invite email.
12. Disconnect Google if you do not want Brain Dump to stay connected.

Suggested test note:

```text
Pay the invoice tomorrow.
Lunch with Sarah Thursday at noon.
Start planning the fall volunteer schedule.
Waiting on Aaron to send the estimate.
Spend 4 hours this week on the website cleanup.
```

## Live Session Script

Use this when watching a first run. Do not over-explain. Let the tester narrate where possible.

1. "Start from the home page and tell me what you think this does."
2. "Open the app and say out loud what you expect the setup panel to mean."
3. "Connect Google when you are ready."
4. "Paste a real messy note. Please do not clean it up first."
5. "Before you click Create, tell me what you think will happen."
6. "Remove one planned action, even if it looks correct."
7. "Click Create."
8. "Now check Google Tasks and Calendar."
9. "Show me anything that surprised you."
10. "Disconnect Google so we can confirm that path."

Record:

- Did they understand the product in under one minute?
- Did they understand review-before-create?
- Did they notice the remove button?
- Did they trust the created items?
- Did any item land somewhere unexpected?
- Did ambiguous calendar work stay in Needs Review?
- Did they find Disconnect Google?

## Feedback Questions

Send these after the first run:

1. What did Brain Dump get right?
2. What did it get wrong or make confusing?
3. Did you trust the review step before clicking Create?
4. Did any task or event appear somewhere unexpected?
5. What would make you use this again next week?
6. What would make you stop using it?
7. How would you describe Brain Dump to someone else?

## Founder Follow-Up Template

Subject: Quick follow-up on Brain Dump

Hi [Name],

Thank you for trying Brain Dump. I have three quick follow-up questions:

1. What was the most useful part?
2. What was the most confusing part?
3. Would you use it again with real work next week?

No need for a polished answer. A few honest sentences are perfect.

Please do not send passwords, OAuth tokens, or private screenshots unless you are comfortable sharing them.

Thank you,

[Your Name]

## First-Five Success Criteria

- At least 4 of 5 testers understand the promise without founder explanation.
- At least 4 of 5 complete Google connection without founder intervention.
- At least 3 of 5 create one useful task or calendar event.
- No tester reports unexpected duplicate writes.
- No tester reports Brain Dump creating vague calendar blocks without review.
- At least 3 of 5 say they would try it again.
