import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleRestProviderClients,
  createMemoryWorkspaceClient,
  createStaticTokenProvider
} from './googleProviderClients';

const tokenProvider = createStaticTokenProvider({
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 3600,
  scope: 'tasks calendar'
});

describe('Google REST provider clients', () => {
  it('posts tasks to the Google Tasks REST API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'task-id' })));
    const clients = createGoogleRestProviderClients({
      tokenProvider,
      fetcher,
      now: () => new Date('2026-07-12T09:00:00.000Z')
    });

    await clients.tasks.createTask({
      taskListId: 'list id',
      title: 'Pay employees',
      notes: 'Payroll run',
      dueDate: 'tomorrow'
    });

    expect(fetcher).toHaveBeenCalledWith('https://tasks.googleapis.com/tasks/v1/lists/list%20id/tasks', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Pay employees',
        notes: 'Payroll run',
        due: '2026-07-13T00:00:00.000Z'
      })
    });
  });

  it('resolves weekday task due dates from the backend clock', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'task-id' })));
    const clients = createGoogleRestProviderClients({
      tokenProvider,
      fetcher,
      now: () => new Date('2026-07-12T09:00:00.000Z')
    });

    await clients.tasks.createTask({
      taskListId: 'list',
      title: 'Send invoice',
      dueDate: 'monday'
    });

    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ due: '2026-07-13T00:00:00.000Z' });
  });

  it('resolves slash date task due dates', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'task-id' })));
    const clients = createGoogleRestProviderClients({
      tokenProvider,
      fetcher,
      now: () => new Date('2026-07-12T09:00:00.000Z')
    });

    await clients.tasks.createTask({
      taskListId: 'list',
      title: 'Order materials',
      dueDate: '7/20/26'
    });

    const [, init] = fetcher.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({ due: '2026-07-20T00:00:00.000Z' });
  });

  it('posts events to the Google Calendar REST API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'event-id' })));
    const clients = createGoogleRestProviderClients({
      tokenProvider,
      fetcher,
      now: () => new Date('2026-07-12T09:00:00.000Z')
    });

    await clients.calendar.createEvent({
      calendarId: 'primary',
      title: 'Lunch with Jack',
      date: 'monday',
      startTime: '12:00 pm',
      durationMinutes: 60,
      notes: 'Bring notes',
      timezone: 'America/Chicago'
    });

    const [, init] = fetcher.mock.calls[0];
    expect(fetcher.mock.calls[0][0]).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    expect(JSON.parse(init.body)).toMatchObject({
      summary: 'Lunch with Jack',
      description: 'Bring notes',
      start: { dateTime: '2026-07-13T12:00:00', timeZone: 'America/Chicago' },
      end: { dateTime: '2026-07-13T13:00:00', timeZone: 'America/Chicago' }
    });
  });

  it('stores project and waiting records in the memory workspace client', async () => {
    const workspace = createMemoryWorkspaceClient(() => new Date('2026-07-12T12:00:00.000Z'));

    await workspace.createProject({
      workspaceId: 'projects',
      title: 'Organize garage',
      sourceText: 'Organize garage'
    });
    await workspace.createWaitingItem({
      workspaceId: 'waiting',
      title: 'Waiting on estimate',
      sourceText: 'Waiting on estimate'
    });

    expect(workspace.records.map((record) => record.type)).toEqual(['project', 'waiting']);
    expect(workspace.records[0]).toMatchObject({
      workspaceId: 'projects',
      title: 'Organize garage',
      createdAt: '2026-07-12T12:00:00.000Z'
    });
  });

  it('raises Google API errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'nope' }), { status: 500 }));
    const clients = createGoogleRestProviderClients({ tokenProvider, fetcher });

    await expect(clients.tasks.createTask({ taskListId: 'list', title: 'Task' })).rejects.toThrow(
      'Google API returned 500'
    );
  });
});
