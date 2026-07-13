# Brain Dump Privacy Policy Draft

Status: draft for product planning. Review with counsel before public launch.

## Overview

Brain Dump helps users turn free-form notes into tasks, calendar events, projects, and waiting-on reminders. The app connects to a user's Google account only after the user grants permission.

## Information We Collect

Account information:

- Email address.
- Basic Google profile information, such as name, when provided by Google.

User content:

- Brain dump text submitted by the user.
- Parsed actions created from that text.
- Project and waiting-on records created by Brain Dump.
- Execution logs showing what Brain Dump attempted to create.
- Privacy-safe product events, such as connect, review, create, error, and disconnect counts.

Google data:

- Google OAuth tokens needed to keep the user's account connected.
- Google Task list metadata needed to create tasks.
- Google Calendar event data created by Brain Dump.

## How We Use Information

Brain Dump uses information to:

- Sign the user in.
- Maintain a secure session.
- Create tasks in the user's Google Tasks account.
- Create calendar events in the user's Google Calendar.
- Avoid duplicate writes.
- Troubleshoot failed requests.
- Improve parsing and routing quality during beta.

## Google User Data

Brain Dump uses Google user data only to provide user-facing app functionality. Brain Dump does not sell Google user data, use it for advertising, or share it with unrelated third parties.

Brain Dump requests the least Google access needed for the current product:

- Sign-in profile and email.
- Google Tasks access to create task lists and tasks.
- Google Calendar event access to create requested events.

Brain Dump does not request Gmail access during beta and does not send emails automatically.

## Storage and Security

Production backend storage should encrypt OAuth refresh tokens at rest. Sessions should use secure, HttpOnly cookies. Access to production logs and stored user records should be limited to authorized operators.

## Sharing

Brain Dump does not share personal data except:

- With service providers needed to run the app.
- When required by law.
- When the user explicitly directs Brain Dump to create content in their connected Google account.

## Retention

During beta, retain execution logs and submitted brain dump records only as long as needed for support, debugging, and product improvement. Define a concrete retention window before public launch.

Product analytics should not include brain dump text, action titles, source text, Google tokens, or calendar/task content.

## User Controls

Users can:

- Disconnect Google from Brain Dump.
- Stop using the app.
- Request deletion of stored account records.
- Delete tasks and calendar events directly in their Google account.

Disconnecting Google removes the stored OAuth tokens and workspace connection records that Brain Dump uses for future writes. It does not delete tasks or calendar events already created in the user's Google account.

## Data Deletion

Before public launch, publish a clear data deletion contact and response process. The product should support deleting stored sessions, OAuth tokens, user workspace records, execution logs, and idempotency records associated with a user.

## Contact

Support email: TBD.

## Changes

Brain Dump may update this policy as the product changes. Material changes should be posted before they take effect.
