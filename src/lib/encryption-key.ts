import { ENCRYPTION_KEY } from "astro:env/server";
import { EncryptionConfigError } from "@/lib/crypto";

/**
 * Server-only Zugriff auf den Verschlüsselungs-Schlüssel.
 *
 * Kapselt den `astro:env/server`-Import (ein Vite-Virtual-Module, in plain
 * Vitest nicht auflösbar) — deshalb lebt er hier und NICHT in `crypto.ts`. Die
 * Krypto-Funktionen erhalten den Key als Parameter und bleiben unit-testbar.
 */
export function getEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    throw new EncryptionConfigError("ENCRYPTION_KEY is not configured.");
  }
  return ENCRYPTION_KEY;
}
