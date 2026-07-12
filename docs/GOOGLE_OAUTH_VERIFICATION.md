# Google OAuth Verification Checklist

Brain Dump uses Google OAuth for sign-in and user-authorized writes to Google Tasks and Google Calendar. Google may require app verification before public availability because Calendar/Tasks permissions can be sensitive.

Official references:

- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Configure the OAuth consent screen](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)

## Current Planned Scopes

Use the narrowest set that supports beta:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/tasks`
- `https://www.googleapis.com/auth/calendar.events`

Do not add Gmail or Drive scopes for beta.

## Scope Justifications

`openid`, `email`, `profile`

- Used to identify the signed-in user, create a backend session, and show connected account status.
- Brain Dump does not use this profile data for advertising or sale.

`https://www.googleapis.com/auth/tasks`

- Used to create or reuse the user's `Brain Dump Work` and `Brain Dump Personal` task lists.
- Used to create tasks from the user's submitted brain dump.
- A narrower read-only scope is not sufficient because Brain Dump creates tasks.

`https://www.googleapis.com/auth/calendar.events`

- Used to create calendar events from explicit user instructions such as date, day, and time.
- Brain Dump should not request broad calendar access if event create/update scope is enough for beta.

## Consent Screen Requirements

Before verification submission:

- App name: `Brain Dump`
- User support email: decide and configure.
- App logo: use supplied Brain Dump icon.
- App home page: public URL on the same domain.
- Privacy policy URL: public URL on the same domain.
- Terms URL: public URL recommended.
- Authorized domain: verified in Google Search Console.
- Developer contact email: monitored inbox.
- OAuth client ID: production web client.
- Redirect URI: production backend callback URL.

## Public Pages Needed

Publish these before public OAuth verification:

- Home page explaining what Brain Dump does.
- Privacy policy explaining Google data access, use, storage, sharing, retention, and disconnect.
- Terms of service.
- Support/contact page or visible support email.

## Demo Video Script

Record an unlisted video for verification:

1. Show Brain Dump home page.
2. Open the app.
3. Click Connect Google.
4. Show the Google OAuth consent screen with the app name.
5. Grant access with a test account.
6. Show connected account status.
7. Submit: `Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.`
8. Show created task in Google Tasks.
9. Show created event in Google Calendar.
10. Show Disconnect Google.

## Internal Testing Mode

Before verification:

- Keep the OAuth app in testing mode.
- Add invited beta users as Google test users.
- Expect tester warning screens.
- Expect limits on test-user count and token behavior.

## Verification Readiness Checklist

- Public domain selected.
- Domain verified.
- Frontend deployed.
- Backend deployed.
- OAuth redirect URI configured.
- Google Tasks API enabled.
- Google Calendar API enabled.
- Privacy policy published.
- Terms published.
- Support email live.
- Demo video recorded.
- Scope justifications written.
- Test account available.
- App screenshots available.
- Data deletion/disconnect behavior documented.

## Notes

Google states that apps requesting sensitive or restricted scopes may need verification before public availability, that privacy policy links must disclose how Google user data is accessed, used, stored, or shared, and that sensitive-scope verification can take time. Build launch timing around that review window.
