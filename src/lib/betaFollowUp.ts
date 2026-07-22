import type { BetaRequestRecord } from '../api/publicContract';

export function betaFollowUpMailto(request: BetaRequestRecord, feedbackUrl: string): string {
  const subject = 'Brain Dump beta follow-up';
  const body = [
    `Hi ${firstName(request.name)},`,
    '',
    'Thanks again for trying Brain Dump. When you have a minute, I would love your first-run feedback.',
    '',
    'The most helpful answers are:',
    '1. What looked right?',
    '2. What looked wrong or confusing?',
    '3. What did you expect Brain Dump to do instead?',
    '',
    `Feedback form: ${feedbackUrl}`,
    '',
    'Please do not send passwords, OAuth tokens, or private screenshots unless you are comfortable sharing them.',
    '',
    'Thanks,',
    'Brain Dump'
  ].join('\n');

  return `mailto:${encodeURIComponent(request.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}
