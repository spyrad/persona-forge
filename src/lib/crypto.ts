/**
 * AES-256-GCM Ver-/Entschlüsselung des API-Keys — reines Logik-Modul.
 *
 * Der Schlüssel wird als Parameter (`keyBase64`) übergeben; dieses Modul liest
 * NICHTS aus `astro:env/server` und bleibt damit trivial unit-testbar (plain
 * Vitest, kein Astro-Plugin). Der Env-Zugriff lebt in `getEncryptionKey()`
 * (`src/lib/encryption-key.ts`), das serverseitig den Key liest und hier reicht.
 *
 * GCM liefert authentifizierte Verschlüsselung (Auth-Tag ist Teil des
 * Ciphertexts) — kein separater HMAC nötig. Web Crypto ist im Cloudflare-Worker
 * und in Node 22 (Vitest) global verfügbar.
 */

const KEY_VERSION = 1;
const IV_BYTES = 12;
const KEY_BYTES = 32;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  keyVersion: number;
}

/** Geworfen, wenn der übergebene Schlüssel fehlt oder ungültig ist (fail-closed). */
export class EncryptionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionConfigError";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importAesKey(keyBase64: string): Promise<CryptoKey> {
  if (!keyBase64) {
    throw new EncryptionConfigError("ENCRYPTION_KEY is missing.");
  }
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = base64ToBytes(keyBase64);
  } catch {
    throw new EncryptionConfigError("ENCRYPTION_KEY is not valid base64.");
  }
  if (raw.length !== KEY_BYTES) {
    throw new EncryptionConfigError(`ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${raw.length}.`);
  }
  return globalThis.crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Verschlüsselt `plaintext` mit dem übergebenen base64-Key (32 Bytes). */
export async function encryptApiKey(plaintext: string, keyBase64: string): Promise<EncryptedPayload> {
  const key = await importAesKey(keyBase64);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
    keyVersion: KEY_VERSION,
  };
}

/** Entschlüsselt eine `EncryptedPayload` mit dem übergebenen base64-Key. */
export async function decryptApiKey(input: EncryptedPayload, keyBase64: string): Promise<string> {
  const key = await importAesKey(keyBase64);
  const iv = base64ToBytes(input.iv);
  const cipher = base64ToBytes(input.ciphertext);
  const plain = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
