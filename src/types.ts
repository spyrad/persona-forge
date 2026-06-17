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
 * Strukturierte Persona-Felder nach `docs/persona-authoring-spec.md` (§§1–6).
 * §§1–4 sind Pflicht (mind. ein Eintrag), §5/§6 optional. Wird als `jsonb`
 * gespeichert und von `compilePersonaPrompt` deterministisch zum `system_prompt`
 * kompiliert.
 */
export interface PersonaStructuredFields {
  /** §1 Kerndenken */
  coreThinking: string[];
  /** §2 Stimme */
  voice: string[];
  /** §3 Entscheidungsfilter */
  decisionFilters: string[];
  /** §4 Bekannte Risiken */
  risks: string[];
  /** §5 Stimme in Aktion (optional) */
  exampleDialog?: string;
  /** §6 Nutzung (optional) */
  usage?: string;
}

/**
 * Client-sichere Projektion einer Persona (camelCase). Personas verstecken kein
 * Material, daher inkl. `systemPrompt`. `isOwn` (aus `owner_id === userId`)
 * steuert Loeschbarkeit/Badge in der UI — globale Seed-Personas sind nicht eigen.
 * `structuredFields` ist nur bei `sourceKind = 'structured'` gesetzt und erlaubt
 * das Vorbefuellen des strukturierten Editors beim „Anpassen".
 */
export interface PersonaView {
  id: string;
  name: string;
  description: string;
  tags: string[];
  systemPrompt: string;
  visibility: Visibility;
  sourceKind: PersonaSourceKind;
  structuredFields: PersonaStructuredFields | null;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Gemeinsame Metadaten beider Eingabewege. */
interface CreatePersonaBase {
  name: string;
  description: string;
  tags: string[];
}

/** Freitext-Eingabe: der System-Prompt wird direkt getippt. */
export interface CreateFreeformPersonaInput extends CreatePersonaBase {
  sourceKind: "freeform";
  systemPrompt: string;
}

/** Strukturierte Eingabe: der System-Prompt wird serverseitig kompiliert. */
export interface CreateStructuredPersonaInput extends CreatePersonaBase {
  sourceKind: "structured";
  structuredFields: PersonaStructuredFields;
}

/**
 * Eingabe beim Anlegen einer Persona — diskriminiert ueber `sourceKind`.
 * Bei `'structured'` kompiliert der Server `systemPrompt` aus `structuredFields`.
 */
export type CreatePersonaInput = CreateFreeformPersonaInput | CreateStructuredPersonaInput;
