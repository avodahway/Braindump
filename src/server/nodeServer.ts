import { createServer, type Server } from 'node:http';
import { createBrainDumpRequestHandler } from './runtimeHandler';
import { handleNodeRequest } from './nodeHttpAdapter';
import type { RuntimeEnv } from './runtimeConfig';

export type NodeServerOptions = {
  env?: RuntimeEnv;
};

export function createBrainDumpNodeServer({ env = process.env }: NodeServerOptions = {}): Server {
  const handle = createBrainDumpRequestHandler(env);

  return createServer((request, response) => {
    void handleNodeRequest(request, response, handle);
  });
}

export function nodeServerPort(env: RuntimeEnv = process.env): number {
  const rawPort = env.PORT?.trim();
  if (!rawPort) return 3000;

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return port;
}
