import type { BetaRequestRecord } from '../api/publicContract';

export function betaInvitationMailto(request: BetaRequestRecord, appUrl: string): string {
  const subject = 'Brain Dump beta access';
  const body = [
    `Hi ${firstName(request.name)},`,
    '',
    'Thanks for requesting access to the Brain Dump beta. You are invited to try the current private beta.',
    '',
    `Open Brain Dump: ${appUrl}`,
    '',
    'A few expectations before you start:',
    '- Preview mode is available before connecting Google.',
    '- Google connection is per user and only after you approve access.',
    '- Brain Dump can create reviewed Google Tasks and clear Calendar events.',
    '- Ambiguous items stay in review.',
    '- Email sending is not enabled during beta.',
    '',
    'After your first run, please send quick feedback from the app or reply with what looked right, what looked confusing, and what you expected instead.',
    '',
    'Thanks,',
    'Brain Dump'
  ].join('\n');

  return `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}
