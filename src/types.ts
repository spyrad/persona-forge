/**
 * Zentrale, geteilte Typen (Entities + DTOs).
 *
 * Konvention (CLAUDE.md): shared Types → `src/types.ts`. Entity-Typen spiegeln
 * die DB-Spalten (snake_case), View-/Input-DTOs sind die client-seitige bzw.
 * API-Vertragsbasis (camelCase, ohne Key-Material).
 */

/** DB-Entity `public.model_configs` — inkl. Krypto-Spalten (server-only). */
export interface ModelConfig {
  id: string;
  owner_id: string;
  label: string;
  base_url: string;
  model_name: string;
  key_ciphertext: string;
  key_iv: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Client-sichere Projektion einer Modellkonfig — OHNE Key-Felder.
 * `hasKey` ersetzt das Key-Material: ein Key ist immer hinterlegt (Spalte
 * `key_ciphertext` ist `not null`), die UI zeigt ihn nur maskiert.
 */
export interface ModelConfigView {
  id: string;
  label: string;
  baseUrl: string;
  modelName: string;
  hasKey: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Eingabe beim Anlegen — Key ist Pflicht. */
export interface CreateModelConfigInput {
  label: string;
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

/**
 * Eingabe beim Editieren — Metadaten Pflicht, Key optional.
 * Fehlt `apiKey`, bleibt der bestehende Key unveraendert.
 */
export interface UpdateModelConfigInput {
  label: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
}
