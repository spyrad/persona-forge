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

/** Sichtbarkeit eines Domaenenobjekts (DB-Enum `public.visibility`). */
export type Visibility = "private" | "global";

/** Eingabeweg einer Persona: frei getippt oder strukturiert nach Spec. */
export type PersonaSourceKind = "freeform" | "structured";

/**
 * DB-Entity `public.personas`. Personas sind unveraenderlich (FR-008): es gibt
 * keinen Update-Pfad, eine Aenderung entsteht nur als Kopie. `owner_id` ist
 * nullable — globale Seed-Personas (FR-009) haben keinen Nutzer-Owner.
 * `structured_fields` traegt in Phase 2 die strukturierten Spec-Felder.
 */
export interface Persona {
  id: string;
  owner_id: string | null;
  visibility: Visibility;
  name: string;
  description: string;
  tags: string[];
  system_prompt: string;
  source_kind: PersonaSourceKind;
  structured_fields: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Client-sichere Projektion einer Persona (camelCase). Personas verstecken kein
 * Material, daher inkl. `systemPrompt`. `isOwn` (aus `owner_id === userId`)
 * steuert Loeschbarkeit/Badge in der UI — globale Seed-Personas sind nicht eigen.
 */
export interface PersonaView {
  id: string;
  name: string;
  description: string;
  tags: string[];
  systemPrompt: string;
  visibility: Visibility;
  sourceKind: PersonaSourceKind;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Eingabe beim Anlegen einer Persona (Phase 1: Freitext). Phase 2 erweitert um
 * den strukturierten Pfad (`structuredFields`/`sourceKind`).
 */
export interface CreatePersonaInput {
  name: string;
  description: string;
  tags: string[];
  systemPrompt: string;
}
