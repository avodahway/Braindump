import { createBrainDumpNodeServer, nodeServerPort } from './nodeServer';
import { describe, expect, it } from 'vitest';

describe('node server', () => {
  it('creates a Node HTTP server from runtime environment settings', () => {
    const server = createBrainDumpNodeServer({
      env: {
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com'
      }
    });

    expect(server.listening).toBe(false);
    expect(server.listenerCount('request')).toBe(1);
  });

  it('uses host-provided PORT or defaults to 3000', () => {
    expect(nodeServerPort({})).toBe(3000);
    expect(nodeServerPort({ PORT: '4177' })).toBe(4177);
  });

  it('rejects invalid PORT values', () => {
    expect(() => nodeServerPort({ PORT: 'not-a-port' })).toThrow('Invalid PORT value');
  });
});
