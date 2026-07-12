import type { UserWorkspace } from '../lib/types';
import type { GoogleProfile, GoogleTokenSet, WorkspaceProvisioner } from './oauthSession';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type GoogleWorkspaceProvisionerOptions = {
  fetcher?: Fetcher;
  workTaskListTitle?: string;
  personalTaskListTitle?: string;
};

type GoogleTaskList = {
  id: string;
  title: string;
};

export function createGoogleWorkspaceProvisioner(
  options: GoogleWorkspaceProvisionerOptions = {}
): WorkspaceProvisioner {
  const fetcher = options.fetcher ?? fetch;
  const workTaskListTitle = options.workTaskListTitle ?? 'Brain Dump Work';
  const personalTaskListTitle = options.personalTaskListTitle ?? 'Brain Dump Personal';

  return {
    async provision(profile, tokens) {
      const taskLists = await listTaskLists(fetcher, tokens);
      const workTaskList = await findOrCreateTaskList(fetcher, tokens, taskLists, workTaskListTitle);
      const personalTaskList = await findOrCreateTaskList(fetcher, tokens, taskLists, personalTaskListTitle);

      return workspaceFromTaskLists(profile, workTaskList, personalTaskList);
    }
  };
}

export function workspaceFromTaskLists(
  profile: GoogleProfile,
  workTaskList: GoogleTaskList,
  personalTaskList: GoogleTaskList
): UserWorkspace {
  return {
    status: 'connected',
    email: profile.email,
    destinations: [
      {
        id: workTaskList.id,
        name: workTaskList.title,
        provider: 'google_tasks',
        kind: 'work_tasks',
        isDefault: true
      },
      {
        id: personalTaskList.id,
        name: personalTaskList.title,
        provider: 'google_tasks',
        kind: 'personal_tasks',
        isDefault: true
      },
      {
        id: 'primary',
        name: 'Primary Calendar',
        provider: 'google_calendar',
        kind: 'calendar',
        isDefault: true
      },
      {
        id: 'brain-dump-projects',
        name: 'Brain Dump Projects',
        provider: 'brain_dump_workspace',
        kind: 'projects',
        isDefault: true
      },
      {
        id: 'brain-dump-waiting',
        name: 'Brain Dump Waiting On',
        provider: 'brain_dump_workspace',
        kind: 'waiting',
        isDefault: true
      }
    ]
  };
}

async function listTaskLists(fetcher: Fetcher, tokens: GoogleTokenSet): Promise<GoogleTaskList[]> {
  const response = await authedJson(fetcher, tokens, taskListsUrl(), { method: 'GET' });
  const value = await response.json();
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.filter(isTaskList);
}

async function findOrCreateTaskList(
  fetcher: Fetcher,
  tokens: GoogleTokenSet,
  taskLists: GoogleTaskList[],
  title: string
): Promise<GoogleTaskList> {
  const existing = taskLists.find((taskList) => taskList.title.toLowerCase() === title.toLowerCase());
  if (existing) return existing;

  const response = await authedJson(fetcher, tokens, taskListsUrl(), {
    method: 'POST',
    body: JSON.stringify({ title })
  });
  const created = await response.json();
  if (isTaskList(created)) {
    taskLists.push(created);
    return created;
  }
  throw new Error(`Google Tasks did not return a task list for ${title}.`);
}

async function authedJson(
  fetcher: Fetcher,
  tokens: GoogleTokenSet,
  url: string,
  init: RequestInit
): Promise<Response> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Google task list setup returned ${response.status}`);
  }

  return response;
}

function taskListsUrl(): string {
  return 'https://tasks.googleapis.com/tasks/v1/users/@me/lists';
}

function isTaskList(value: unknown): value is GoogleTaskList {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
