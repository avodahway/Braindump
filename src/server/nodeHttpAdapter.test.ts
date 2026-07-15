import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { toWebRequest } from './nodeHttpAdapter';

describe('node HTTP adapter', () => {
  it('rejects oversized request bodies before creating a web request', async () => {
    const request = Readable.from(['x'.repeat(64 * 1024 + 1)]) as IncomingMessage;
    request.method = 'POST';
    request.url = '/api/events';
    request.headers = {
      host: 'api.example.com'
    };

    await expect(toWebRequest(request)).rejects.toThrow('Request body is too large.');
  });

  it('uses a configured request body size limit', async () => {
    const request = Readable.from(['x'.repeat(11)]) as IncomingMessage;
    request.method = 'POST';
    request.url = '/api/events';
    request.headers = {
      host: 'api.example.com'
    };

    await expect(toWebRequest(request, { maxRequestBodyBytes: 10 })).rejects.toThrow('Request body is too large.');
  });
});
