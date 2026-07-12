import { describe, expect, it } from 'vitest';
import { parseBrainDump, parseLine, splitBrainDump } from './parser';

describe('splitBrainDump', () => {
  it('splits bullets, lines, and sentences', () => {
    expect(splitBrainDump('- Pay employees tomorrow.\nLunch with Jack Thursday at noon; put on calendar.')).toEqual([
      'Pay employees tomorrow.',
      'Lunch with Jack Thursday at noon; put on calendar.'
    ]);
  });
});

describe('parseLine', () => {
  it('routes work terms to Avodah work tasks', () => {
    const [action] = parseLine('Pay employees tomorrow');
    expect(action.type).toBe('work_task');
    expect(action.dueDate).toBe('tomorrow');
  });

  it('routes explicit date and time calendar language to calendar', () => {
    const [action] = parseLine('Lunch with Jack Thursday at noon; put on calendar.');
    expect(action.type).toBe('calendar');
    expect(action.calendarDate).toBe('thursday');
    expect(action.startTime).toBe('12:00 pm');
  });

  it('sends calendar items without date and time to review', () => {
    const [action] = parseLine('Meeting with Brandon; put on calendar');
    expect(action.type).toBe('needs_review');
  });

  it('routes delegated dependencies to waiting', () => {
    const [action] = parseLine('Waiting on Aaron Jones to send the estimate');
    expect(action.type).toBe('waiting');
  });

  it('creates project plus calendar block for weekly hour allocation', () => {
    const actions = parseLine('Spend 4 hours this week on the porch replacement project');
    expect(actions.map((action) => action.type)).toEqual(['project', 'calendar']);
  });

  it('does not send email automatically', () => {
    const [action] = parseLine('send email to test@example.com about the invoice');
    expect(action.type).toBe('needs_review');
  });
});

describe('parseBrainDump', () => {
  it('summarizes grouped results', () => {
    const result = parseBrainDump('Pay employees tomorrow. Lunch with Jack Thursday at noon; put on calendar.', 'req-1');
    expect(result.summary.workTasks).toBe(1);
    expect(result.summary.calendar).toBe(1);
    expect(result.requestId).toBe('req-1');
  });
});
