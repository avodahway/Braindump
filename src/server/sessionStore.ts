export type SessionRecord = {
  id: string;
  userId: string;
  createdAt: number;
};

export type SessionStore = {
  createSession(userId: string): Promise<SessionRecord>;
  readSession(sessionId: string): Promise<SessionRecord | undefined>;
  deleteSession(sessionId: string): Promise<void>;
};

export const sessionCookieName = 'bd_session';

export function createMemorySessionStore(now: () => number = Date.now): SessionStore & {
  sessions: Map<string, SessionRecord>;
} {
  const sessions = new Map<string, SessionRecord>();

  return {
    sessions,
    async createSession(userId) {
      const session = {
        id: createSessionId(),
        userId,
        createdAt: now()
      };
      sessions.set(session.id, session);
      return session;
    },
    async readSession(sessionId) {
      return sessions.get(sessionId);
    },
    async deleteSession(sessionId) {
      sessions.delete(sessionId);
    }
  };
}

export function sessionCookie(sessionId: string): string {
  return `${sessionCookieName}=${sessionId}; Path=/; HttpOnly; SameSite=None; Secure`;
}

export function clearSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`;
}

export function readSessionIdFromCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .map((part) => part.split('='))
    .find(([name]) => name === sessionCookieName)?.[1];
}

export function createSessionId(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
