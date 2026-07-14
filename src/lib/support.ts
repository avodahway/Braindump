import type { BrainDumpResponse } from './types';

export const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@braindump.app';

export function supportMailto({
  subject,
  body
}: {
  subject: string;
  body: string;
}): string {
  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function feedbackMailto(result: BrainDumpResponse): string {
  const actionLines = result.actions.map((action) => `- ${action.type}: ${action.title} (${action.status ?? 'planned'})`);
  return supportMailto({
    subject: `Brain Dump beta feedback: ${result.requestId}`,
    body: [
      'What looked right?',
      '',
      'What looked wrong or confusing?',
      '',
      'What did you expect Brain Dump to do instead?',
      '',
      `Request ID: ${result.requestId}`,
      `Summary: ${JSON.stringify(result.summary)}`,
      'Actions:',
      ...actionLines
    ].join('\n')
  });
}

export function betaFeedbackMailto(): string {
  return supportMailto({
    subject: 'Brain Dump beta feedback',
    body: [
      'What looked right?',
      '',
      'What looked wrong or confusing?',
      '',
      'What did you expect Brain Dump to do instead?',
      '',
      'Optional: Google account email used with Brain Dump',
      '',
      'Optional: approximate time of your test'
    ].join('\n')
  });
}

export function betaAccessMailto(): string {
  return supportMailto({
    subject: 'Brain Dump beta access request',
    body: [
      'Name:',
      '',
      'Email:',
      '',
      'What do you currently use for tasks and calendar?',
      '',
      'What would make Brain Dump useful enough for you to keep using?',
      '',
      'Are you comfortable connecting Google Tasks and Google Calendar during beta?'
    ].join('\n')
  });
}

export function supportRequestMailto(context: string): string {
  return supportMailto({
    subject: `Brain Dump beta support: ${context}`,
    body: [
      'What happened?',
      '',
      'What were you trying to do?',
      '',
      'What did you expect to happen?',
      '',
      `Context: ${context}`
    ].join('\n')
  });
}
