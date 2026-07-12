import { describe, expect, it, vi } from 'vitest';
import type { ParsedAction, UserWorkspace } from '../lib/types';
import { createGoogleActionExecutor, type GoogleProviderClients } from './googleExecutor';

const workspace: UserWorkspace = {
  status: 'connected',
  email: 'demo@example.com',
  destinations: [
    { id: 'work-list', name: 'Work Tasks', provider: 'google_tasks', kind: 'work_tasks', isDefault: true },
    { id: 'personal-list', name: 'Personal Tasks', provider: 'google_tasks', kind: 'personal_tasks', isDefault: true },
    { id: 'calendar-id', name: 'Calendar', provider: 'google_calendar', kind: 'calendar', isDefault: true },
    { id: 'project-workspace', name: 'Projects', provider: 'brain_dump_workspace', kind: 'projects', isDefault: true },
    { id: 'waiting-workspace', name: 'Waiting', provider: 'brain_dump_workspace', kind: 'waiting', isDefault: true }
  ]
};

describe('Google action executor', () => {
  it('creates work and personal tasks in the selected task lists', async () => {
    const clients = fakeClients();
    const executor = createGoogleActionExecutor(clients);

    await executor.execute(action('work_task', { title: 'Pay employees', dueDate: 'tomorrow' }), workspace);
    await executor.execute(action('personal_task', { title: 'Buy milk' }), workspace);

    expect(clients.tasks.createTask).toHaveBeenCalledWith({
      taskListId: 'work-list',
      title: 'Pay employees',
      notes: undefined,
      dueDate: 'tomorrow'
    });
    expect(clients.tasks.createTask).toHaveBeenCalledWith({
      taskListId: 'personal-list',
      title: 'Buy milk',
      notes: undefined,
      dueDate: undefined
    });
  });

  it('creates calendar events only when date and time are explicit', async () => {
    const clients = fakeClients();
    const executor = createGoogleActionExecutor(clients);

    const created = await executor.execute(
      action('calendar', {
        title: 'Lunch with Jack',
        calendarDate: 'thursday',
        startTime: '12:00 pm',
        durationMinutes: 60
      }),
      workspace,
      { requestId: 'req-1', timezone: 'America/Chicago' }
    );
    const needsReview = await executor.execute(
      action('calendar', { title: 'Work block', calendarDate: 'this week', startTime: 'safe-default-required' }),
      workspace
    );

    expect(created.status).toBe('created');
    expect(needsReview.status).toBe('needs_review');
    expect(clients.calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(clients.calendar.createEvent).toHaveBeenCalledWith({
      calendarId: 'calendar-id',
      title: 'Lunch with Jack',
      date: 'thursday',
      startTime: '12:00 pm',
      durationMinutes: 60,
      notes: undefined,
      timezone: 'America/Chicago'
    });
  });

  it('creates project and waiting workspace records', async () => {
    const clients = fakeClients();
    const executor = createGoogleActionExecutor(clients);

    await executor.execute(action('project', { title: 'Organize garage' }), workspace);
    await executor.execute(action('waiting', { title: 'Waiting on estimate' }), workspace);

    expect(clients.workspace.createProject).toHaveBeenCalledWith({
      workspaceId: 'project-workspace',
      title: 'Organize garage',
      notes: undefined,
      sourceText: 'Organize garage'
    });
    expect(clients.workspace.createWaitingItem).toHaveBeenCalledWith({
      workspaceId: 'waiting-workspace',
      title: 'Waiting on estimate',
      notes: undefined,
      sourceText: 'Waiting on estimate'
    });
  });

  it('returns provider failures as execution errors', async () => {
    const clients = fakeClients();
    clients.tasks.createTask = vi.fn().mockRejectedValue(new Error('Tasks API failed'));

    const result = await createGoogleActionExecutor(clients).execute(action('work_task'), workspace);

    expect(result.status).toBe('error');
    expect(result.message).toBe('Tasks API failed');
  });
});

function fakeClients(): GoogleProviderClients {
  return {
    tasks: {
      createTask: vi.fn().mockResolvedValue({ id: 'task-id' })
    },
    calendar: {
      createEvent: vi.fn().mockResolvedValue({ id: 'event-id' })
    },
    workspace: {
      createProject: vi.fn().mockResolvedValue({ id: 'project-id' }),
      createWaitingItem: vi.fn().mockResolvedValue({ id: 'waiting-id' })
    }
  };
}

function action(type: ParsedAction['type'], overrides: Partial<ParsedAction> = {}): ParsedAction {
  return {
    type,
    title: 'Test action',
    sourceText: overrides.title ?? 'Test action',
    ...overrides
  };
}
