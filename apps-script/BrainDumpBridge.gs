/**
 * Brain Dump JSON bridge for Cleveland Stewardship OS.
 *
 * Install this file in the existing CSOS Apps Script project. It intentionally
 * uses BD_ prefixes so it can live beside the legacy menu/modal prototype.
 */

const BD_CONFIG = {
  projectSheet: 'Active Projects',
  waitingSheet: 'Waiting On',
  logSheet: 'CSOS Execution Log',
  defaultTimezone: 'America/Chicago',
  workTerms: [
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
  ],
  calendarTerms: ['put on calendar', 'calendar', 'meeting', 'lunch', 'appointment', 'bible study'],
  projectTerms: ['project', 'finish', 'build', 'replace', 'organize', 'clean out', 'launch', 'plan'],
  waitingTerms: ['waiting on', 'follow up with', 'check in with', 'needs to send', 'after they', 'when they']
};

function doPost(e) {
  try {
    const request = BD_parseRequest_(e);
    BD_verifySecret_(request);
    BD_validateRequest_(request);

    if (BD_seenRequest_(request.requestId)) {
      return BD_json_({
        ok: true,
        requestId: request.requestId,
        summary: BD_emptySummary_(),
        actions: [],
        errors: ['Duplicate request ignored.']
      });
    }

    const planned = BD_splitBrainDump_(request.text).reduce(function(actions, line) {
      return actions.concat(BD_planLine_(line));
    }, []);

    const executed = [];
    const errors = [];

    planned.forEach(function(action) {
      try {
        const result = BD_executeAction_(action, request);
        action.status = result.status;
        action.result = result.message;
        executed.push(action);
        BD_log_(request.requestId, action.type, action.title, result.status, result.message, action.sourceText);
      } catch (error) {
        action.status = 'error';
        action.result = error.message;
        executed.push(action);
        errors.push(error.message);
        BD_log_(request.requestId, action.type || 'error', action.title || action.sourceText, 'error', error.message, action.sourceText);
      }
    });

    BD_markRequest_(request.requestId);

    return BD_json_({
      ok: errors.length === 0,
      requestId: request.requestId,
      summary: BD_summary_(executed),
      actions: executed,
      errors: errors
    });
  } catch (error) {
    return BD_json_({
      ok: false,
      requestId: '',
      summary: BD_emptySummary_(),
      actions: [],
      errors: [error.message]
    });
  }
}

function BD_parseRequest_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  return JSON.parse(raw);
}

function BD_verifySecret_(request) {
  const expected = PropertiesService.getScriptProperties().getProperty('BRAIN_DUMP_SHARED_SECRET');
  if (expected && request.sharedSecret !== expected) {
    throw new Error('Invalid shared secret.');
  }
}

function BD_validateRequest_(request) {
  if (!request.requestId) throw new Error('Missing requestId.');
  if (!request.text || !String(request.text).trim()) throw new Error('Missing text.');
}

function BD_seenRequest_(requestId) {
  return CacheService.getScriptCache().get('brain-dump-request-' + requestId) === '1';
}

function BD_markRequest_(requestId) {
  CacheService.getScriptCache().put('brain-dump-request-' + requestId, '1', 21600);
}

function BD_splitBrainDump_(text) {
  return String(text)
    .replace(/\r/g, '\n')
    .split(/\n+|(?<=[.!?])\s+/)
    .map(function(line) {
      return line.trim().replace(/^[•*\-\d.)\s]+/, '');
    })
    .filter(Boolean);
}

function BD_planLine_(line) {
  const lower = line.toLowerCase();
  const actions = [];
  const title = BD_cleanTitle_(line);
  const time = BD_extractTime_(line);
  const date = BD_extractDate_(line);
  const hours = BD_extractHours_(line);

  if (lower.indexOf('send email') !== -1 || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(line)) {
    return [BD_needsReview_(line, 'Email captured for review. Brain Dump v1 never sends email automatically.')];
  }

  if (BD_hasAny_(lower, BD_CONFIG.waitingTerms)) {
    actions.push({ type: 'waiting', title: title, notes: line, sourceText: line });
  }

  if (hours && /\b(this week|weekly|project|hours?)\b/.test(lower)) {
    const projectTitle = BD_projectTitle_(line);
    actions.push({ type: 'project', title: projectTitle, hours: hours, notes: line, sourceText: line });
    actions.push({
      type: 'calendar',
      title: projectTitle + ' work block',
      calendarDate: date || 'this week',
      startTime: time || 'safe-default-required',
      durationMinutes: Math.min(hours * 60, 120),
      notes: line,
      sourceText: line
    });
    return BD_dedupe_(actions);
  }

  if (BD_hasAny_(lower, BD_CONFIG.calendarTerms)) {
    if (!time || !date) {
      actions.push(BD_needsReview_(line, 'Calendar items need an explicit date/day and time.'));
    } else {
      actions.push({
        type: 'calendar',
        title: BD_cleanCalendarTitle_(line),
        calendarDate: date,
        startTime: time,
        durationMinutes: lower.indexOf('bible study') !== -1 ? 90 : 60,
        notes: line,
        sourceText: line
      });
    }
  }

  if (BD_hasAny_(lower, BD_CONFIG.projectTerms) && !/\b(buy|call|email|text|order|pay)\b/.test(lower)) {
    actions.push({ type: 'project', title: title, notes: line, sourceText: line });
  }

  if (!actions.length && /\b(maybe|someday|think about|figure out|not sure|possibly)\b/.test(lower)) {
    actions.push(BD_needsReview_(line, 'Ambiguous item captured for review.'));
  }

  if (!actions.length) {
    actions.push({
      type: BD_isWorkTask_(lower) ? 'work_task' : 'personal_task',
      title: title,
      dueDate: date,
      notes: line,
      sourceText: line
    });
  }

  return BD_dedupe_(actions);
}

function BD_executeAction_(action, request) {
  if (action.type === 'needs_review') {
    return { status: 'needs_review', message: 'Captured for review: ' + action.title };
  }
  if (action.type === 'work_task') return BD_createTask_(action, 'CSOS_WORK_TASK_LIST_ID');
  if (action.type === 'personal_task') return BD_createTask_(action, 'CSOS_PERSONAL_TASK_LIST_ID');
  if (action.type === 'project') return BD_createProject_(action);
  if (action.type === 'waiting') return BD_createWaiting_(action);
  if (action.type === 'calendar') return BD_createCalendar_(action, request);
  throw new Error('Unknown action type: ' + action.type);
}

function BD_createTask_(action, propertyName) {
  const taskListId = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (!taskListId) throw new Error('Missing script property: ' + propertyName);

  const resource = {
    title: action.title,
    notes: action.notes || ''
  };

  if (action.dueDate) {
    resource.due = BD_dueDateToIso_(action.dueDate);
  }

  const task = Tasks.Tasks.insert(resource, taskListId);
  return { status: 'created', message: 'Task created: ' + task.title };
}

function BD_createProject_(action) {
  const sheet = BD_requiredSheet_(BD_CONFIG.projectSheet);
  const existing = BD_findTitleRow_(sheet, action.title, 2);
  if (existing) {
    sheet.getRange(existing, 8).setValue(action.notes || '');
    return { status: 'created', message: 'Project updated: ' + action.title };
  }

  const row = sheet.getLastRow() + 1;
  const id = BD_nextId_(sheet, 'P');
  sheet.getRange(row, 1, 1, 10).setValues([[
    id,
    action.title,
    '',
    'Active',
    'High',
    true,
    'Next action',
    action.notes || '',
    '',
    'Brain Dump'
  ]]);
  return { status: 'created', message: 'Project created: ' + action.title };
}

function BD_createWaiting_(action) {
  const sheet = BD_requiredSheet_(BD_CONFIG.waitingSheet);
  sheet.appendRow([new Date(), action.title, action.notes || '', '', '', 'Waiting', '', 'Brain Dump']);
  return { status: 'created', message: 'Waiting item created: ' + action.title };
}

function BD_createCalendar_(action, request) {
  if (action.startTime === 'safe-default-required') {
    return { status: 'needs_review', message: 'Calendar work block needs a configured safe default time.' };
  }

  const calendarId = PropertiesService.getScriptProperties().getProperty('CSOS_WORK_CALENDAR_ID') ||
    PropertiesService.getScriptProperties().getProperty('CSOS_PERSONAL_CALENDAR_ID') ||
    'primary';
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('Calendar not found: ' + calendarId);

  const start = BD_resolveDateTime_(action.calendarDate, action.startTime, request.timezone || BD_CONFIG.defaultTimezone);
  const end = new Date(start.getTime() + (action.durationMinutes || 60) * 60000);
  const event = calendar.createEvent(action.title, start, end, { description: action.notes || '' });
  return { status: 'created', message: 'Calendar created: ' + event.getTitle() };
}

function BD_log_(requestId, type, title, status, result, sourceText) {
  const sheet = BD_requiredSheet_(BD_CONFIG.logSheet);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Request ID', 'Type', 'Title', 'Status', 'Result', 'Source']);
  }
  sheet.appendRow([new Date(), requestId, type, title, status, result, sourceText || '']);
}

function BD_summary_(actions) {
  return {
    calendar: actions.filter(function(action) { return action.type === 'calendar' && action.status === 'created'; }).length,
    workTasks: actions.filter(function(action) { return action.type === 'work_task' && action.status === 'created'; }).length,
    personalTasks: actions.filter(function(action) { return action.type === 'personal_task' && action.status === 'created'; }).length,
    projects: actions.filter(function(action) { return action.type === 'project' && action.status === 'created'; }).length,
    waiting: actions.filter(function(action) { return action.type === 'waiting' && action.status === 'created'; }).length,
    needsReview: actions.filter(function(action) { return action.status === 'needs_review'; }).length
  };
}

function BD_emptySummary_() {
  return { calendar: 0, workTasks: 0, personalTasks: 0, projects: 0, waiting: 0, needsReview: 0 };
}

function BD_json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function BD_hasAny_(lower, terms) {
  return terms.some(function(term) {
    return lower.indexOf(term) !== -1;
  });
}

function BD_isWorkTask_(lower) {
  return BD_hasAny_(lower, BD_CONFIG.workTerms);
}

function BD_needsReview_(line, notes) {
  return { type: 'needs_review', title: BD_cleanTitle_(line), notes: notes, sourceText: line };
}

function BD_extractHours_(line) {
  const match = line.match(/\b(\d+(?:\.\d+)?)\s*hours?\b/i);
  return match ? Number(match[1]) : null;
}

function BD_extractTime_(line) {
  const lower = line.toLowerCase();
  const numeric = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (numeric) {
    return Number(numeric[1]) + ':' + (numeric[2] || '00') + ' ' + numeric[3];
  }
  if (/\bnoon\b/.test(lower)) return '12:00 pm';
  if (/\bmidnight\b/.test(lower)) return '12:00 am';
  return null;
}

function BD_extractDate_(line) {
  const lower = line.toLowerCase();
  const relative = lower.match(/\b(today|tomorrow|this week|next week)\b/);
  if (relative) return relative[1];
  const weekday = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekday) return weekday[1];
  const date = lower.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  return date ? date[1] : null;
}

function BD_cleanTitle_(line) {
  return String(line)
    .replace(/\b(put on calendar|send email)\b/gi, '')
    .replace(/[\s;,.]+$/g, '')
    .trim();
}

function BD_cleanCalendarTitle_(line) {
  return BD_cleanTitle_(line)
    .replace(/\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(at|@)\s*(\d{1,2})(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b(at|@)\s*(noon|midnight)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function BD_projectTitle_(line) {
  return BD_cleanTitle_(line).replace(/\b\d+(?:\.\d+)?\s*hours?\b/gi, '').replace(/\s+/g, ' ').trim();
}

function BD_dedupe_(actions) {
  const seen = {};
  return actions.filter(function(action) {
    const key = action.type + ':' + action.title;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function BD_requiredSheet_(sheetName) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('CSOS_SPREADSHEET_ID');
  const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  return sheet;
}

function BD_findTitleRow_(sheet, title, column) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, column, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).toLowerCase() === String(title).toLowerCase()) return index + 2;
  }
  return null;
}

function BD_nextId_(sheet, prefix) {
  return prefix + '-' + Utilities.formatString('%05d', Math.max(sheet.getLastRow(), 1));
}

function BD_dueDateToIso_(dateToken) {
  const date = BD_resolveDate_(dateToken, BD_CONFIG.defaultTimezone);
  return Utilities.formatDate(date, 'UTC', "yyyy-MM-dd'T'00:00:00.000'Z'");
}

function BD_resolveDateTime_(dateToken, timeToken, timezone) {
  const date = BD_resolveDate_(dateToken, timezone);
  const time = BD_parseTimeToken_(timeToken);
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

function BD_resolveDate_(dateToken, timezone) {
  const today = new Date();
  const token = String(dateToken || 'today').toLowerCase();

  if (token === 'tomorrow') {
    today.setDate(today.getDate() + 1);
    return today;
  }
  if (token === 'next week') {
    today.setDate(today.getDate() + 7);
    return today;
  }
  if (token === 'this week') return today;

  const weekdayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(token);
  if (weekdayIndex >= 0) {
    const current = Number(Utilities.formatDate(today, timezone, 'u')) % 7;
    const delta = (weekdayIndex - current + 7) % 7 || 7;
    today.setDate(today.getDate() + delta);
    return today;
  }

  if (/^\d{1,2}\/\d{1,2}/.test(token)) return new Date(token);
  return today;
}

function BD_parseTimeToken_(timeToken) {
  const match = String(timeToken).toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!match) throw new Error('Invalid time: ' + timeToken);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (match[3] === 'pm' && hour !== 12) hour += 12;
  if (match[3] === 'am' && hour === 12) hour = 0;
  return { hour: hour, minute: minute };
}
