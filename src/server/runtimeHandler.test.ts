import { describe, expect, it } from 'vitest';
import { publicBackendRoutes } from '../api/publicContract';
import { createBrainDumpRequestHandler } from './runtimeHandler';

describe('runtime handler', () => {
  it('creates a request handler from runtime environment settings', async () => {
    const handle = createBrainDumpRequestHandler({
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      BRAIN_DUMP_PUBLIC_API_ORIGIN: 'https://api.example.com'
    });

    const response = await handle(new Request(`https://api.example.com${publicBackendRoutes.workspace}`));
    const workspace = await response.json();

    expect(workspace.status).toBe('not_connected');
  });
});
