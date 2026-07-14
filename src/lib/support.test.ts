import { describe, expect, it } from 'vitest';
import { betaFeedbackMailto, feedbackMailto, supportMailto, supportRequestMailto } from './support';
import type { BrainDumpResponse } from './types';

describe('support links', () => {
  it('builds encoded mailto links', () => {
    expect(supportMailto({ subject: 'Hello world', body: 'Line 1\nLine 2' })).toContain(
      'subject=Hello%20world&body=Line%201%0ALine%202'
    );
  });

  it('includes request context in feedback links', () => {
    const href = feedbackMailto(brainDumpResponse());

    expect(decodeURIComponent(href)).toContain('Brain Dump beta feedback: req-1');
    expect(decodeURIComponent(href)).toContain('Request ID: req-1');
    expect(decodeURIComponent(href)).toContain('personal_task: Buy coffee');
  });

  it('builds support request links', () => {
    expect(decodeURIComponent(supportRequestMailto('OAuth'))).toContain('Context: OAuth');
  });

  it('builds a reusable beta feedback link', () => {
    const href = decodeURIComponent(betaFeedbackMailto());

    expect(href).toContain('Brain Dump beta feedback');
    expect(href).toContain('What looked right?');
    expect(href).toContain('What looked wrong or confusing?');
    expect(href).toContain('What did you expect Brain Dump to do instead?');
  });
});

function brainDumpResponse(): BrainDumpResponse {
  return {
    ok: true,
    requestId: 'req-1',
    summary: {
      calendar: 0,
      workTasks: 0,
      personalTasks: 1,
      projects: 0,
      waiting: 0,
      needsReview: 0
    },
    actions: [
      {
        type: 'personal_task',
        title: 'Buy coffee',
        status: 'created',
        sourceText: 'Buy coffee'
      }
    ],
    errors: []
  };
}
