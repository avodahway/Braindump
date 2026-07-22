import { describe, expect, it } from 'vitest';
import { createAesGcmSecretCodec } from './storageCrypto';

const storageSecret = '0123456789abcdef0123456789abcdef';

describe('storage crypto', () => {
  it('encrypts and decrypts storage values', async () => {
    const codec = createAesGcmSecretCodec(storageSecret);

    const encrypted = await codec.encode('{"refreshToken":"secret-token"}');

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain('secret-token');
    await expect(codec.decode(encrypted)).resolves.toBe('{"refreshToken":"secret-token"}');
  });

  it('uses a unique iv for each encrypted value', async () => {
    const codec = createAesGcmSecretCodec(storageSecret);

    const first = await codec.encode('same-value');
    const second = await codec.encode('same-value');

    expect(first).not.toBe(second);
  });

  it('fails to decrypt with the wrong secret', async () => {
    const codec = createAesGcmSecretCodec(storageSecret);
    const wrongCodec = createAesGcmSecretCodec('abcdef0123456789abcdef0123456789');
    const encrypted = await codec.encode('stored-value');

    await expect(wrongCodec.decode(encrypted)).rejects.toThrow();
  });

  it('requires a long storage secret', () => {
    expect(() => createAesGcmSecretCodec('short')).toThrow('BRAIN_DUMP_STORAGE_SECRET must be at least 32 characters.');
  });
});
