import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';

export type RequestHandler = (request: Request) => Promise<Response>;

const defaultMaxRequestBodyBytes = 64 * 1024;

class HttpRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function handleNodeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  handler: RequestHandler
): Promise<void> {
  try {
    const webRequest = await toWebRequest(request);
    const webResponse = await handler(webRequest);
    await writeNodeResponse(response, webResponse);
  } catch (error) {
    response.statusCode = error instanceof HttpRequestError ? error.status : 500;
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected server error.'
      })
    );
  }
}

export async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const method = request.method ?? 'GET';
  const url = requestUrl(request);
  const headers = requestHeaders(request);
  const body = method === 'GET' || method === 'HEAD' ? undefined : await requestBody(request, defaultMaxRequestBodyBytes);

  return new Request(url, { method, headers, body });
}

export async function writeNodeResponse(response: ServerResponse, webResponse: Response): Promise<void> {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  if (!webResponse.body) {
    response.end();
    return;
  }

  const body = Buffer.from(await webResponse.arrayBuffer());
  response.end(body);
}

function requestUrl(request: IncomingMessage): string {
  const host = request.headers.host ?? 'localhost';
  const forwardedProto = headerValue(request.headers['x-forwarded-proto']);
  const protocol = forwardedProto ?? 'http';
  return `${protocol}://${host}${request.url ?? '/'}`;
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function requestBody(request: IncomingMessage, maxBodyBytes: number): Promise<ArrayBuffer> {
  const contentLength = Number(headerValue(request.headers['content-length']));
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new HttpRequestError(413, 'Request body is too large.');
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBodyBytes) {
      throw new HttpRequestError(413, 'Request body is too large.');
    }
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}
