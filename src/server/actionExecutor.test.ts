import { describe, expect, it } from 'vitest';
import type { ParsedAction, UserWorkspace } from '../lib/types';
import { calendarNeedsReview, createDemoActionExecutor, destinationForAction } from './actionExecutor';

const workspace: UserWorkspace = {
  status: 'connected',
  email: 'demo@example.com',
  destinations: [
    { id: 'work', name: 'Work Tasks', provider: 'google_tasks', kind: 'work_tasks', isDefault: true },
    { id: 'personal', name: 'Personal Tasks', provider: 'google_tasks', kind: 'personal_tasks', isDefault: true },
    { id: 'calendar', name: 'Calendar', provider: 'google_calendar', kind: 'calendar', isDefault: true },
    { id: 'projects', name: 'Projects', provider: 'brain_dump_workspace', kind: 'projects', isDefault: true },
    { id: 'waiting', name: 'Waiting', provider: 'brain_dump_workspace', kind: 'waiting', isDefault: true }
  ]
};

describe('action executor', () => {
  it('maps action types to workspace destinations', () => {
    expect(destinationForAction(action('work_task'), workspace)?.id).toBe('work');
    expect(destinationForAction(action('personal_task'), workspace)?.id).toBe('personal');
    expect(destinationForAction(action('calendar'), workspace)?.id).toBe('calendar');
    expect(destinationForAction(action('project'), workspace)?.id).toBe('projects');
    expect(destinationForAction(action('waiting'), workspace)?.id).toBe('waiting');
  });

  it('marks needs-review actions without provider writes', async () => {
    const result = await createDemoActionExecutor().execute(action('needs_review'), workspace);

    expect(result.status).toBe('needs_review');
    expect(result.providerId).toBeUndefined();
  });

  it('returns an error when a destination is missing', async () => {
    const result = await createDemoActionExecutor().execute(action('work_task'), {
      ...workspace,
      destinations: workspace.destinations.filter((destination) => destination.kind !== 'work_tasks')
    });

    expect(result.status).toBe('error');
  });

  it('keeps unsafe calendar actions in review in demo execution', async () => {
    const result = await createDemoActionExecutor().execute(
      {
        type: 'calendar',
        title: 'Work block',
        calendarDate: 'this week',
        startTime: 'safe-default-required',
        sourceText: 'Spend 4 hours this week'
      },
      workspace
    );

    expect(result.status).toBe('needs_review');
    expect(result.providerId).toBeUndefined();
  });

  it('detects calendar actions that still need review', () => {
    expect(calendarNeedsReview(action('calendar'))).toBe(true);
    expect(
      calendarNeedsReview({
        type: 'calendar',
        title: 'Lunch',
        calendarDate: 'thursday',
        startTime: '12:00 pm',
        sourceText: 'Lunch Thursday at noon'
      })
    ).toBe(false);
  });
});

function action(type: ParsedAction['type']): ParsedAction {
  return {
    type,
    title: 'Test action',
    sourceText: 'Test action'
  };
}
