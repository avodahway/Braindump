import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';

export type RequestHandler = (request: Request) => Promise<Response>;

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
    response.statusCode = 500;
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
  const body = method === 'GET' || method === 'HEAD' ? undefined : await requestBody(request);

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

async function requestBody(request: IncomingMessage): Promise<ArrayBuffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);
  return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
}
