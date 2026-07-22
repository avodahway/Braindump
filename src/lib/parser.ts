import type { BrainDumpResponse, ParsedAction } from './types';

const workTerms = [
  'avodah',
  'employee',
  'employees',
  'payroll',
  'client',
  'brandon',
  'aaron jones',
  'miles terry',
  'invoice',
  'estimate',
  'job site'
];

const calendarTerms = ['put on calendar', 'calendar', 'meeting', 'lunch', 'appointment', 'bible study'];
const projectTerms = ['project', 'finish', 'build', 'replace', 'organize', 'clean out', 'launch', 'plan'];
const waitingTerms = ['waiting on', 'waiting for', 'follow up with', 'follow-up with', 'check in with', 'needs to send', 'after they', 'when they'];
const reviewTerms = ['maybe', 'someday', 'think about', 'figure out', 'not sure', 'possibly'];

export function splitBrainDump(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.trim().replace(/^[•*\-\d.)\s]+/, ''))
    .filter(Boolean);
}

export function parseBrainDump(text: string, requestId: string = crypto.randomUUID()): BrainDumpResponse {
  const actions = splitBrainDump(text).flatMap(parseLine);
  return {
    ok: true,
    requestId,
    summary: {
      calendar: actions.filter((action) => action.type === 'calendar').length,
      workTasks: actions.filter((action) => action.type === 'work_task').length,
      personalTasks: actions.filter((action) => action.type === 'personal_task').length,
      projects: actions.filter((action) => action.type === 'project').length,
      waiting: actions.filter((action) => action.type === 'waiting').length,
      needsReview: actions.filter((action) => action.type === 'needs_review').length
    },
    actions,
    errors: []
  };
}

export function parseLine(line: string): ParsedAction[] {
  const lower = line.toLowerCase();
  const actions: ParsedAction[] = [];
  const title = cleanTitle(line);
  const time = extractTime(line);
  const date = extractDateToken(line);
  const hours = extractHours(line);

  if (isUnsafeEmail(lower)) {
    return [needsReview(line, 'Email captured for review. Brain Dump v1 never sends email automatically.')];
  }

  if (hasAny(lower, waitingTerms)) {
    actions.push({ type: 'waiting', title, status: 'planned', notes: line, sourceText: line });
  }

  if (hours && /\b(this week|weekly|project|hours?)\b/.test(lower)) {
    actions.push({
      type: 'project',
      title: projectTitle(line),
      status: 'planned',
      hours,
      notes: line,
      sourceText: line
    });
    if (date || /\bthis week\b/.test(lower)) {
      actions.push({
        type: 'calendar',
        title: `${projectTitle(line)} work block`,
        status: 'planned',
        durationMinutes: Math.min(hours * 60, 120),
        calendarDate: date ?? 'this week',
        startTime: time ?? 'safe-default-required',
        notes: line,
        sourceText: line
      });
    }
    return dedupe(actions);
  }

  if (hasAny(lower, calendarTerms)) {
    if (!time || !date) {
      actions.push(needsReview(line, 'Calendar items need an explicit date/day and time.'));
    } else {
      actions.push({
        type: 'calendar',
        title: cleanCalendarTitle(line),
        status: 'planned',
        calendarDate: date,
        startTime: time,
        durationMinutes: lower.includes('bible study') ? 90 : 60,
        notes: line,
        sourceText: line
      });
    }
  }

  if (hasAny(lower, projectTerms) && !/\b(buy|call|email|text|order|pay)\b/.test(lower)) {
    actions.push({ type: 'project', title, status: 'planned', notes: line, sourceText: line });
  }

  if (!actions.length && hasAny(lower, reviewTerms)) {
    actions.push(needsReview(line, 'Ambiguous item captured for review.'));
  }

  if (!actions.length) {
    actions.push({
      type: isWorkTask(lower) ? 'work_task' : 'personal_task',
      title,
      status: 'planned',
      dueDate: date,
      notes: line,
      sourceText: line
    });
  }

  return dedupe(actions);
}

function isWorkTask(lower: string): boolean {
  return workTerms.some((term) => lower.includes(term));
}

function hasAny(lower: string, terms: string[]): boolean {
  return terms.some((term) => lower.includes(term));
}

function isUnsafeEmail(lower: string): boolean {
  return lower.includes('send email') || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(lower);
}

function needsReview(sourceText: string, notes: string): ParsedAction {
  return {
    type: 'needs_review',
    title: cleanTitle(sourceText),
    status: 'needs_review',
    notes,
    sourceText
  };
}

function extractHours(line: string): number | undefined {
  const match = line.match(/\b(\d+(?:\.\d+)?)\s*hours?\b/i);
  return match ? Number(match[1]) : undefined;
}

function extractTime(line: string): string | undefined {
  const lower = line.toLowerCase();
  const numeric = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (numeric) {
    const hour = Number(numeric[1]);
    const minute = numeric[2] ?? '00';
    return `${hour}:${minute.padStart(2, '0')} ${numeric[3]}`;
  }
  if (/\bnoon\b/.test(lower)) return '12:00 pm';
  if (/\bmidnight\b/.test(lower)) return '12:00 am';
  return undefined;
}

function extractDateToken(line: string): string | undefined {
  const lower = line.toLowerCase();
  const relative = lower.match(/\b(today|tomorrow|this week|next week)\b/);
  if (relative) return relative[1];
  const weekday = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekday) return weekday[1];
  const date = lower.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  return date?.[1];
}

function cleanTitle(line: string): string {
  return line
    .replace(/\b(put on calendar|send email)\b/gi, '')
    .replace(/[\s;,.]+$/g, '')
    .trim();
}

function cleanCalendarTitle(line: string): string {
  return cleanTitle(line)
    .replace(/\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(at|@)\s*(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b(at|@)\s*(noon|midnight)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function projectTitle(line: string): string {
  return cleanTitle(line).replace(/\b\d+(?:\.\d+)?\s*hours?\b/gi, '').replace(/\s+/g, ' ').trim();
}

function dedupe(actions: ParsedAction[]): ParsedAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
