import type { UserWorkspace } from '../lib/types';

const workspaceKey = 'brain-dump-workspace';

export function loadWorkspace(): UserWorkspace {
  try {
    const workspace = JSON.parse(localStorage.getItem(workspaceKey) ?? '') as UserWorkspace;
    return workspace.status ? workspace : disconnectedWorkspace();
  } catch {
    return disconnectedWorkspace();
  }
}

export function connectDemoWorkspace(): UserWorkspace {
  const workspace: UserWorkspace = {
    status: 'connected',
    email: 'demo@braindump.local',
    destinations: [
      {
        id: 'tasks-work-demo',
        name: 'Brain Dump Work',
        provider: 'google_tasks',
        kind: 'work_tasks',
        isDefault: true
      },
      {
        id: 'tasks-personal-demo',
        name: 'Brain Dump Personal',
        provider: 'google_tasks',
        kind: 'personal_tasks',
        isDefault: true
      },
      {
        id: 'calendar-demo',
        name: 'Brain Dump Calendar',
        provider: 'google_calendar',
        kind: 'calendar',
        isDefault: true
      },
      {
        id: 'workspace-demo',
        name: 'Brain Dump Workspace',
        provider: 'brain_dump_workspace',
        kind: 'projects',
        isDefault: true
      },
      {
        id: 'waiting-demo',
        name: 'Brain Dump Waiting On',
        provider: 'brain_dump_workspace',
        kind: 'waiting',
        isDefault: true
      }
    ]
  };
  localStorage.setItem(workspaceKey, JSON.stringify(workspace));
  return workspace;
}

export function disconnectWorkspace(): UserWorkspace {
  const workspace = disconnectedWorkspace();
  localStorage.setItem(workspaceKey, JSON.stringify(workspace));
  return workspace;
}

function disconnectedWorkspace(): UserWorkspace {
  return { status: 'not_connected', destinations: [] };
}
