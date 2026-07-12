import type { ParsedAction, UserWorkspace } from '../lib/types';
import { destinationForAction, type ActionExecutor, type ExecutionResult } from './actionExecutor';

export type GoogleTaskPayload = {
  taskListId: string;
  title: string;
  notes?: string;
  dueDate?: string;
};

export type GoogleCalendarPayload = {
  calendarId: string;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  notes?: string;
  timezone?: string;
};

export type WorkspaceRecordPayload = {
  workspaceId: string;
  title: string;
  notes?: string;
  sourceText: string;
};

export type GoogleProviderClients = {
  tasks: {
    createTask(payload: GoogleTaskPayload): Promise<{ id: string }>;
  };
  calendar: {
    createEvent(payload: GoogleCalendarPayload): Promise<{ id: string }>;
  };
  workspace: {
    createProject(payload: WorkspaceRecordPayload): Promise<{ id: string }>;
    createWaitingItem(payload: WorkspaceRecordPayload): Promise<{ id: string }>;
  };
};

export function createGoogleActionExecutor(clients: GoogleProviderClients): ActionExecutor {
  return {
    async execute(action, workspace, context) {
      if (action.type === 'needs_review') {
        return { status: 'needs_review', message: `Needs review: ${action.title}` };
      }

      const destination = destinationForAction(action, workspace);
      if (!destination) {
        return { status: 'error', message: `No destination configured for ${action.type}` };
      }

      try {
        if (action.type === 'work_task' || action.type === 'personal_task') {
          const task = await clients.tasks.createTask({
            taskListId: destination.id,
            title: action.title,
            notes: action.notes,
            dueDate: action.dueDate
          });
          return created(`Task created: ${action.title}`, task.id);
        }

        if (action.type === 'calendar') {
          if (!action.calendarDate || !action.startTime || action.startTime === 'safe-default-required') {
            return { status: 'needs_review', message: `Calendar needs review: ${action.title}` };
          }

          const event = await clients.calendar.createEvent({
            calendarId: destination.id,
            title: action.title,
            date: action.calendarDate,
            startTime: action.startTime,
            durationMinutes: action.durationMinutes ?? 60,
            notes: action.notes,
            timezone: context?.timezone
          });
          return created(`Calendar event created: ${action.title}`, event.id);
        }

        if (action.type === 'project') {
          const project = await clients.workspace.createProject(recordPayload(destination.id, action));
          return created(`Project created: ${action.title}`, project.id);
        }

        if (action.type === 'waiting') {
          const waiting = await clients.workspace.createWaitingItem(recordPayload(destination.id, action));
          return created(`Waiting item created: ${action.title}`, waiting.id);
        }

        return { status: 'error', message: `Unsupported action type: ${action.type}` };
      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : `Provider write failed for ${action.title}`
        };
      }
    }
  };
}

function recordPayload(workspaceId: string, action: ParsedAction): WorkspaceRecordPayload {
  return {
    workspaceId,
    title: action.title,
    notes: action.notes,
    sourceText: action.sourceText
  };
}

function created(message: string, providerId: string): ExecutionResult {
  return { status: 'created', message, providerId };
}
