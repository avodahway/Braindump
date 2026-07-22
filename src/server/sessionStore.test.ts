import { describe, expect, it } from 'vitest';
import {
  clearSessionCookie,
  createMemorySessionStore,
  readSessionIdFromCookie,
  sessionCookie,
  sessionCookieName
} from './sessionStore';

describe('session store', () => {
  it('creates, reads, and deletes sessions', async () => {
    const store = createMemorySessionStore(() => 1000);
    const session = await store.createSession('person@example.com');

    expect(session.id).toHaveLength(48);
    expect(await store.readSession(session.id)).toEqual({
      id: session.id,
      userId: 'person@example.com',
      createdAt: 1000
    });

    await store.deleteSession(session.id);
    expect(await store.readSession(session.id)).toBeUndefined();
  });

  it('formats and reads the session cookie', () => {
    const cookie = sessionCookie('session-id');

    expect(cookie).toContain(`${sessionCookieName}=session-id`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=None');
    expect(cookie).toContain('Secure');
    expect(readSessionIdFromCookie('theme=dark; bd_session=session-id; other=true')).toBe('session-id');
    expect(clearSessionCookie()).toContain('Max-Age=0');
    expect(clearSessionCookie()).toContain('SameSite=None');
  });
});
