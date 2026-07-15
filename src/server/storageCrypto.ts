import { Buffer } from 'node:buffer';
import type { SecretCodec } from './durableStore';

const algorithm = 'AES-GCM';
const version = 'v1';

export function createAesGcmSecretCodec(secret: string): SecretCodec {
  const trimmedSecret = secret.trim();
  if (trimmedSecret.length < 32) {
    throw new Error('BRAIN_DUMP_STORAGE_SECRET must be at least 32 characters.');
  }

  return {
    async encode(value) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await importKey(trimmedSecret);
      const encrypted = await crypto.subtle.encrypt({ name: algorithm, iv }, key, new TextEncoder().encode(value));
      return `${version}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
    },
    async decode(value) {
      const [storedVersion, iv, encrypted] = value.split(':');
      if (storedVersion !== version || !iv || !encrypted) {
        throw new Error('Unsupported encrypted storage value.');
      }

      const key = await importKey(trimmedSecret);
      const decrypted = await crypto.subtle.decrypt(
        { name: algorithm, iv: fromBase64(iv) },
        key,
        fromBase64(encrypted)
      );
      return new TextDecoder().decode(decrypted);
    }
  };
}

async function importKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, algorithm, false, ['encrypt', 'decrypt']);
}

function toBase64(value: Uint8Array): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64(value: string): ArrayBuffer {
  const buffer = Buffer.from(value, 'base64url');
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
