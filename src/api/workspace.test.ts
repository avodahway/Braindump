import { describe, expect, it } from 'vitest';
import { connectDemoWorkspace, disconnectWorkspace, loadWorkspace } from './workspace';

describe('workspace demo connection', () => {
  it('starts disconnected, connects demo destinations, and disconnects', () => {
    localStorage.clear();

    expect(loadWorkspace().status).toBe('not_connected');

    const connected = connectDemoWorkspace();
    expect(connected.status).toBe('connected');
    expect(connected.destinations.map((destination) => destination.kind)).toEqual([
      'work_tasks',
      'personal_tasks',
      'calendar',
      'projects',
      'waiting'
    ]);
    expect(loadWorkspace().email).toBe('demo@braindump.local');

    expect(disconnectWorkspace().status).toBe('not_connected');
  });
});
