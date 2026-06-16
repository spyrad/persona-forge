import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey, EncryptionConfigError } from "@/lib/crypto";

// 32-Byte-Key (ASCII → 32 Bytes) als base64 — direkt übergeben, kein astro:env nötig.
const TEST_KEY = btoa("0123456789abcdef0123456789abcdef");

describe("crypto", () => {
  it("entschlüsselt, was verschlüsselt wurde (Roundtrip)", async () => {
    const samples = ["sk-test-abc123", "", "ünïcödé-🔑-key", "x".repeat(2048)];
    for (const plaintext of samples) {
      const payload = await encryptApiKey(plaintext, TEST_KEY);
      const decrypted = await decryptApiKey(payload, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    }
  });

  it("liefert keyVersion 1", async () => {
    const payload = await encryptApiKey("sk-test", TEST_KEY);
    expect(payload.keyVersion).toBe(1);
  });

  it("erzeugt je Verschlüsselung frische IV und unterschiedlichen Ciphertext", async () => {
    const a = await encryptApiKey("sk-same-input", TEST_KEY);
    const b = await encryptApiKey("sk-same-input", TEST_KEY);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("wirft EncryptionConfigError bei leerem Key", async () => {
    await expect(encryptApiKey("sk-test", "")).rejects.toBeInstanceOf(EncryptionConfigError);
  });

  it("wirft EncryptionConfigError bei zu kurzem Key", async () => {
    const shortKey = btoa("too-short");
    await expect(encryptApiKey("sk-test", shortKey)).rejects.toBeInstanceOf(EncryptionConfigError);
  });

  it("schlägt bei manipuliertem Ciphertext fehl (GCM-Auth)", async () => {
    const payload = await encryptApiKey("sk-tamper-me", TEST_KEY);
    // Erstes base64-Zeichen kippen, um den Ciphertext (inkl. Auth-Tag) zu verändern.
    const flipped = payload.ciphertext.startsWith("A") ? "B" : "A";
    const tampered = { ...payload, ciphertext: flipped + payload.ciphertext.slice(1) };
    await expect(decryptApiKey(tampered, TEST_KEY)).rejects.toBeTruthy();
  });
});
