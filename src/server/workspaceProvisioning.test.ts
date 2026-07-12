import { describe, expect, it, vi } from 'vitest';
import { createGoogleWorkspaceProvisioner, workspaceFromTaskLists } from './workspaceProvisioning';

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 1000,
  scope: 'tasks'
};

describe('workspace provisioning', () => {
  it('reuses existing Brain Dump task lists', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          { id: 'work-list-id', title: 'Brain Dump Work' },
          { id: 'personal-list-id', title: 'Brain Dump Personal' }
        ]
      })
    );
    const provisioner = createGoogleWorkspaceProvisioner({ fetcher });

    const workspace = await provisioner.provision({ email: 'user@example.com' }, tokens);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(workspace.destinations.filter((destination) => destination.provider === 'google_tasks')).toEqual([
      {
        id: 'work-list-id',
        name: 'Brain Dump Work',
        provider: 'google_tasks',
        kind: 'work_tasks',
        isDefault: true
      },
      {
        id: 'personal-list-id',
        name: 'Brain Dump Personal',
        provider: 'google_tasks',
        kind: 'personal_tasks',
        isDefault: true
      }
    ]);
  });

  it('creates missing Brain Dump task lists', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'created-work', title: 'Brain Dump Work' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'created-personal', title: 'Brain Dump Personal' }));
    const provisioner = createGoogleWorkspaceProvisioner({ fetcher });

    const workspace = await provisioner.provision({ email: 'user@example.com' }, tokens);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Brain Dump Work' })
    });
    expect(workspace.destinations.find((destination) => destination.kind === 'work_tasks')?.id).toBe('created-work');
    expect(workspace.destinations.find((destination) => destination.kind === 'personal_tasks')?.id).toBe(
      'created-personal'
    );
  });

  it('keeps calendar, projects, and waiting destinations in the provisioned workspace', () => {
    const workspace = workspaceFromTaskLists(
      { email: 'user@example.com' },
      { id: 'work-id', title: 'Work' },
      { id: 'personal-id', title: 'Personal' }
    );

    expect(workspace.destinations.map((destination) => destination.kind)).toEqual([
      'work_tasks',
      'personal_tasks',
      'calendar',
      'projects',
      'waiting'
    ]);
  });
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
