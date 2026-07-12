import { createBrainDumpBackend } from './backendFactory';
import type { RuntimeConfigOptions, RuntimeEnv } from './runtimeConfig';
import { loadBrainDumpBackendConfig } from './runtimeConfig';

export function createBrainDumpRequestHandler(env: RuntimeEnv, options: RuntimeConfigOptions = {}) {
  const backend = createBrainDumpBackend(loadBrainDumpBackendConfig(env, options));
  return (request: Request): Promise<Response> => backend.handle(request);
}
