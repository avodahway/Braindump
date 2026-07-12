import type { ParsedAction, UserDestination, UserWorkspace } from '../lib/types';

export type ExecutionResult = {
  status: 'created' | 'needs_review' | 'error';
  message: string;
  providerId?: string;
};

export type ExecutionContext = {
  requestId: string;
  timezone: string;
  userId?: string;
};

export type ActionExecutor = {
  execute(action: ParsedAction, workspace: UserWorkspace, context?: ExecutionContext): Promise<ExecutionResult>;
};

export function createDemoActionExecutor(): ActionExecutor {
  return {
    async execute(action, workspace) {
      if (action.type === 'needs_review') {
        return { status: 'needs_review', message: `Needs review: ${action.title}` };
      }

      if (calendarNeedsReview(action)) {
        return { status: 'needs_review', message: `Calendar needs review: ${action.title}` };
      }

      const destination = destinationForAction(action, workspace);
      if (!destination) {
        return {
          status: 'error',
          message: `No destination configured for ${action.type}`
        };
      }

      return {
        status: 'created',
        providerId: `${destination.provider}:${destination.id}`,
        message: `${destination.name}: ${action.title}`
      };
    }
  };
}

export function destinationForAction(action: ParsedAction, workspace: UserWorkspace): UserDestination | undefined {
  const kind = kindForAction(action);
  if (!kind) return undefined;
  return workspace.destinations.find((destination) => destination.kind === kind && destination.isDefault) ??
    workspace.destinations.find((destination) => destination.kind === kind);
}

export function calendarNeedsReview(action: ParsedAction): boolean {
  return action.type === 'calendar' && (!action.calendarDate || !action.startTime || action.startTime === 'safe-default-required');
}

function kindForAction(action: ParsedAction): UserDestination['kind'] | undefined {
  if (action.type === 'work_task') return 'work_tasks';
  if (action.type === 'personal_task') return 'personal_tasks';
  if (action.type === 'calendar') return 'calendar';
  if (action.type === 'project') return 'projects';
  if (action.type === 'waiting') return 'waiting';
  return undefined;
}
