export type ActionType =
  | 'calendar'
  | 'work_task'
  | 'personal_task'
  | 'project'
  | 'waiting'
  | 'needs_review'
  | 'error';

export type ParsedAction = {
  type: ActionType;
  title: string;
  status?: 'planned' | 'created' | 'needs_review' | 'error';
  notes?: string;
  dueDate?: string;
  calendarDate?: string;
  startTime?: string;
  durationMinutes?: number;
  hours?: number;
  sourceText: string;
};

export type BrainDumpRequest = {
  requestId: string;
  text: string;
  timezone: string;
  approvedActions?: ParsedAction[];
};

export type BrainDumpResponse = {
  ok: boolean;
  requestId: string;
  summary: {
    calendar: number;
    workTasks: number;
    personalTasks: number;
    projects: number;
    waiting: number;
    needsReview: number;
  };
  actions: ParsedAction[];
  errors: string[];
};

export type ConnectionStatus = 'mock' | 'not_connected' | 'connected' | 'private_bridge';

export type UserDestination = {
  id: string;
  name: string;
  provider: 'google_tasks' | 'google_calendar' | 'brain_dump_workspace';
  kind: 'work_tasks' | 'personal_tasks' | 'calendar' | 'projects' | 'waiting';
  isDefault: boolean;
};

export type UserWorkspace = {
  status: ConnectionStatus;
  email?: string;
  destinations: UserDestination[];
};
