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

// ─── Test-Instrument (OEJTS, S-04) ──────────────────────────────────────────

/** Eine Achse/Skala eines Instruments (bei OEJTS die 4 Jung'schen Dichotomien). */
export interface InstrumentAxis {
  /** Achsen-Schluessel, z. B. "IE". */
  key: string;
  /** Scoring-Konstante (siehe OEJTS-Formeln). */
  constant: number;
  /** Score > cutoff → `high`-Pol, sonst `low`. */
  cutoff: number;
  /** Buchstabe bei Score > cutoff. */
  high: string;
  /** Buchstabe bei Score <= cutoff. */
  low: string;
  /** Menschenlesbares Label. */
  label?: string;
}

/** Ein bipolares Item: 1 = voll `left`, 5 = voll `right`. */
export interface InstrumentItem {
  /** Item-Id, z. B. "Q1". */
  id: string;
  /** Achse, zu der das Item beitraegt. */
  axis: string;
  /** Vorzeichen im Achsen-Score (+1 oder -1). */
  sign: 1 | -1;
  /** Beschreibung am linken Pol (Antwortwert 1). */
  left: string;
  /** Beschreibung am rechten Pol (Antwortwert 5). */
  right: string;
}

/** Ein psychometrisches Instrument (v1 hartkodiert, FR-011). */
export interface Instrument {
  id: string;
  items: InstrumentItem[];
  axes: InstrumentAxis[];
  /** Ob die Item-Reihenfolge je Wiederholung permutiert wird (FR-012). */
  permute: boolean;
}

// ─── Laeufe (runs / run_repetitions, S-04) ───────────────────────────────────

/** Status eines Laufs. */
export type RunStatus = "pending" | "running" | "completed" | "failed";

/** Status einer einzelnen Wiederholung. */
export type RepetitionStatus = "pending" | "ok" | "failed";

/** Geparster Wert eines Items innerhalb einer Wiederholung (jsonb-Element). */
export interface ItemValue {
  id: string;
  /** Skalenwert 1–5, oder null wenn nicht parsebar. */
  value: number | null;
  status: "ok" | "unparsed";
}

/**
 * DB-Entity `public.runs`. Ein Lauf ist selbst-enthalten: der aufgeloeste
 * Persona-System-Prompt wird als Snapshot gespeichert, damit der Lauf
 * reproduzierbar bleibt, auch wenn Persona/Modellkonfig spaeter geloescht werden
 * (FKs `on delete set null`). `visibility` default 'private' (Toggle = S-07).
 */
export interface Run {
  id: string;
  owner_id: string;
  visibility: Visibility;
  persona_id: string | null;
  model_config_id: string | null;
  persona_prompt_snapshot: string;
  instrument_id: string;
  repetition_count: number;
  status: RunStatus;
  prompt_tokens: number;
  completion_tokens: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * DB-Entity `public.run_repetitions`. Eine Zeile je Wiederholung; die Roh-Response
 * liegt hier (bei 1 Call/Wiederholung), die geparsten Item-Werte als jsonb-Array.
 */
export interface RunRepetition {
  id: string;
  run_id: string;
  rep_index: number;
  /** Verwendete Item-Reihenfolge (Indizes) — Reproduktions-Artefakt. */
  item_order: number[];
  raw_response: string | null;
  item_values: ItemValue[] | null;
  status: RepetitionStatus;
  error: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
  updated_at: string;
}

/** Client-sichere Projektion eines Laufs. */
export interface RunView {
  id: string;
  personaId: string | null;
  modelConfigId: string | null;
  instrumentId: string;
  repetitionCount: number;
  status: RunStatus;
  promptTokens: number;
  completionTokens: number;
  failedCount: number;
  /** Anzahl bereits geschriebener Wiederholungen (aus run_repetitions gezaehlt). */
  completedReps: number;
  visibility: Visibility;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Eingabe beim Starten eines Laufs. */
export interface CreateRunInput {
  personaId: string;
  modelConfigId: string;
  instrumentId: string;
  repetitionCount: number;
}

/** Fortschritts-Antwort eines Orchestrierungs-Schritts (Phase 2). */
export interface RunProgress {
  status: RunStatus;
  completedReps: number;
  totalReps: number;
  failedCount: number;
  /** Bis hierhin akkumulierter Token-Verbrauch (FR-015) — fuer den Live-Zaehler. */
  promptTokens: number;
  completionTokens: number;
}

// ─── Ergebnis-Auswertung (Verteilung je Achse, S-05) ─────────────────────────

/**
 * Verteilung einer Achse ueber die verwertbaren Wiederholungen eines Laufs.
 * `mean`/`sd` sind `null`, wenn keine Wiederholung zu dieser Achse beitrug
 * (achsen-weiser Dropout). `scale` traegt die je-Achse berechneten Skalengrenzen
 * (die Achsen-Konstanten verschieben die Skala) fuer die Visualisierung.
 */
export interface AxisDistribution {
  key: string;
  label: string;
  /** Lage: Mittelwert des Achsen-Scores (null wenn usableCount 0). */
  mean: number | null;
  /** Streuung: Populations-Standardabweichung (null wenn usableCount 0). */
  sd: number | null;
  /** Roh-Verteilung: die einzelnen Achsen-Scores je beitragender Wiederholung. */
  scores: number[];
  /** Haeufigkeit je Pol-Buchstabe ueber die beitragenden Wiederholungen, z. B. {E:4, I:1}. */
  letterCounts: Record<string, number>;
  /** Anzahl Wiederholungen, die zu dieser Achse beitrugen (alle 8 Items geparst). */
  usableCount: number;
  scale: { min: number; max: number; cutoff: number };
  /** Buchstabe bei Score > cutoff. */
  high: string;
  /** Buchstabe bei Score <= cutoff. */
  low: string;
}

/** Aggregiertes Lauf-Ergebnis: Achsen-Verteilungen + Typ-Stabilitaet. */
export interface RunAggregate {
  axes: AxisDistribution[];
  /** Modaltyp aus den achsenweisen Mehrheits-Buchstaben (null, wenn keine Achse beitrug). */
  modalType: string | null;
  /** Anteil der Wiederholungen mit vollstaendigem Typ, die exakt `modalType` ergeben (0–1; null wenn n. a.). */
  typeConsistency: number | null;
  /** Anzahl Wiederholungen, die zu mindestens einer Achse beitrugen. */
  usableReps: number;
}

/**
 * Client-sichere Ergebnis-Sicht eines Laufs. `state` kodiert die UI-Verzweigung:
 *   - `ready`: aggregiertes Ergebnis vorhanden (≥1 verwertbare Wiederholung).
 *   - `empty`: Lauf abgeschlossen/failed, aber 0 verwertbare Wiederholungen.
 *   - `unfinished`: Lauf noch `pending`/`running` — kein Ergebnis.
 */
export interface RunResultView {
  run: RunView;
  aggregate: RunAggregate | null;
  state: "ready" | "empty" | "unfinished";
}
