import type {
  GoogleCalendarPayload,
  GoogleProviderClients,
  GoogleTaskPayload,
  WorkspaceRecordPayload
} from './googleExecutor';
import type { GoogleTokenSet } from './oauthSession';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type TokenProvider = {
  getAccessToken(): Promise<string>;
};

export type GoogleRestClientOptions = {
  tokenProvider: TokenProvider;
  fetcher?: Fetcher;
  now?: () => Date;
};

export type WorkspaceRecord = WorkspaceRecordPayload & {
  id: string;
  createdAt: string;
  type: 'project' | 'waiting';
};

export function createGoogleRestProviderClients(options: GoogleRestClientOptions): GoogleProviderClients {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    tasks: {
      async createTask(payload) {
        const response = await authedJson(fetcher, options.tokenProvider, googleTasksUrl(payload.taskListId), {
          method: 'POST',
          body: JSON.stringify(toGoogleTask(payload))
        });
        return { id: readProviderId(await response.json(), 'Google Tasks') };
      }
    },
    calendar: {
      async createEvent(payload) {
        const response = await authedJson(fetcher, options.tokenProvider, googleCalendarUrl(payload.calendarId), {
          method: 'POST',
          body: JSON.stringify(toGoogleCalendarEvent(payload, now()))
        });
        return { id: readProviderId(await response.json(), 'Google Calendar') };
      }
    },
    workspace: createMemoryWorkspaceClient(now)
  };
}

export function createStaticTokenProvider(tokens: GoogleTokenSet): TokenProvider {
  return {
    async getAccessToken() {
      return tokens.accessToken;
    }
  };
}

export function createMemoryWorkspaceClient(now: () => Date = () => new Date()): GoogleProviderClients['workspace'] & {
  records: WorkspaceRecord[];
} {
  const records: WorkspaceRecord[] = [];

  return {
    records,
    async createProject(payload) {
      const record = createWorkspaceRecord('project', payload, now());
      records.push(record);
      return { id: record.id };
    },
    async createWaitingItem(payload) {
      const record = createWorkspaceRecord('waiting', payload, now());
      records.push(record);
      return { id: record.id };
    }
  };
}

function googleTasksUrl(taskListId: string): string {
  return `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`;
}

function googleCalendarUrl(calendarId: string): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

function toGoogleTask(payload: GoogleTaskPayload) {
  return {
    title: payload.title,
    notes: payload.notes,
    due: payload.dueDate ? dueDateToGoogleIso(payload.dueDate) : undefined
  };
}

function toGoogleCalendarEvent(payload: GoogleCalendarPayload, now: Date) {
  const start = resolveLocalDateTime(payload.date, payload.startTime, now);
  const end = addMinutes(start, payload.durationMinutes);

  return {
    summary: payload.title,
    description: payload.notes,
    start: {
      dateTime: start,
      timeZone: payload.timezone
    },
    end: {
      dateTime: end,
      timeZone: payload.timezone
    }
  };
}

function dueDateToGoogleIso(dateToken: string): string | undefined {
  if (!dateToken) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) return `${dateToken}T00:00:00.000Z`;
  return undefined;
}

function resolveLocalDateTime(dateToken: string, timeToken: string, now: Date): string {
  const date = resolveDateParts(dateToken, now);
  const time = parseTime(timeToken);
  return `${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(time.hour)}:${pad(time.minute)}:00`;
}

function resolveDateParts(dateToken: string, now: Date): { year: number; month: number; day: number } {
  const date = new Date(now);
  const token = dateToken.toLowerCase();
  if (token === 'today') return toDateParts(date);
  if (token === 'tomorrow') {
    date.setDate(date.getDate() + 1);
    return toDateParts(date);
  }

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const weekday = weekdays.indexOf(token);
  if (weekday >= 0) {
    const delta = (weekday - date.getDay() + 7) % 7 || 7;
    date.setDate(date.getDate() + delta);
    return toDateParts(date);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    const [year, month, day] = token.split('-').map(Number);
    return { year, month, day };
  }
  return toDateParts(date);
}

function parseTime(timeToken: string): { hour: number; minute: number } {
  const match = timeToken.toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) throw new Error(`Invalid time token: ${timeToken}`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3] === 'pm' && hour !== 12) hour += 12;
  if (match[3] === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

function addMinutes(localDateTime: string, minutes: number): string {
  const date = new Date(`${localDateTime}Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00`;
}

function toDateParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

async function authedJson(
  fetcher: Fetcher,
  tokenProvider: TokenProvider,
  url: string,
  init: RequestInit
): Promise<Response> {
  const token = await tokenProvider.getAccessToken();
  const response = await fetcher(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`Google API returned ${response.status}`);
  }

  return response;
}

function readProviderId(value: unknown, provider: string): string {
  if (isRecord(value) && typeof value.id === 'string') return value.id;
  throw new Error(`${provider} response did not include an id`);
}

function createWorkspaceRecord(type: WorkspaceRecord['type'], payload: WorkspaceRecordPayload, date: Date): WorkspaceRecord {
  return {
    ...payload,
    type,
    id: `${type}-${date.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: date.toISOString()
  };
}

function isRecord(value: unknown): value is { id?: unknown } {
  return typeof value === 'object' && value !== null;
}
