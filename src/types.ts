/**
 * Zentrale, geteilte Typen (Entities + DTOs).
 *
 * Konvention (CLAUDE.md): shared Types → `src/types.ts`. Entity-Typen spiegeln
 * die DB-Spalten (snake_case), View-/Input-DTOs sind die client-seitige bzw.
 * API-Vertragsbasis (camelCase, ohne Key-Material).
 */

// `RunView`/`RunProgress` werden aus ihren zod-Schemas abgeleitet (Single Source,
// C-B). Hier importiert, um sie unten unveraendert weiter aus `@/types` zu
// re-exportieren und gegen `RunStatus`/`Visibility`-Drift zu guarden.
import type { RunView, RunProgress } from "@/lib/runs/run-schemas";
import type { RunTiming } from "@/lib/runs/run-timing";
import type { RunFailureSummary } from "@/lib/runs/run-failures";

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

// ─── Test-Instrumente (OEJTS S-04, HEXACO) ──────────────────────────────────

/**
 * Eine Achse/Skala eines Instruments (bei OEJTS die 4 Jung'schen Dichotomien,
 * bei HEXACO die 6 Faktoren). `midpoint` ist die Skalen-Referenz je Achse:
 * bei Modaltyp-Instrumenten zugleich die Typ-Schwelle (OEJTS, vormals `cutoff`),
 * bei Likert-Instrumenten die Skalenmitte (Referenzlinie der Charts).
 */
export interface InstrumentAxis {
  /** Achsen-Schluessel, z. B. "IE" oder "H". */
  key: string;
  /** Scoring-Konstante (score = constant + Σ sign·antwort). */
  constant: number;
  /** Skalen-Referenz: Typ-Schwelle (Modaltyp) bzw. Skalenmitte (Likert). */
  midpoint: number;
  /** Buchstabe bei Score > midpoint — nur bei `hasModalType`-Instrumenten. */
  high?: string;
  /** Buchstabe bei Score <= midpoint — nur bei `hasModalType`-Instrumenten. */
  low?: string;
  /** Menschenlesbares Label. */
  label?: string;
}

/** Ein bipolares Item: 1 = voll `left`, 5 = voll `right` (OEJTS). */
export interface BipolarInstrumentItem {
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

/**
 * Ein Likert-Aussage-Item: Zustimmung 1–5 zu einer Selbstbeschreibung (IPIP/HEXACO).
 * `sign` traegt das Keying: -1 = revers gekeyt (Beitrag 6 − antwort, via constant).
 */
export interface LikertInstrumentItem {
  /** Item-Id, z. B. "H1". */
  id: string;
  /** Achse/Faktor, zu der das Item beitraegt. */
  axis: string;
  /** Keying-Vorzeichen im Achsen-Score (+1 oder -1). */
  sign: 1 | -1;
  /** Aussagetext (Selbstbeschreibung), z. B. "Talk a lot". */
  text: string;
}

/**
 * Item-Union: bipolare Pol-Paare (OEJTS) und Likert-Aussagen (HEXACO) koexistieren —
 * OEJTS-Pol-Paare sind nicht verlustfrei in Likert wandelbar (Plan-Review P3).
 */
export type InstrumentItem = BipolarInstrumentItem | LikertInstrumentItem;

/**
 * Herkunfts-/Lizenz-Metadaten je Instrument (statt statisch fuer OEJTS). Traegt
 * die Angaben, die beim Anzeigen von Ergebnissen als Attribution Pflicht sind
 * (Spec-Abnahme; OEJTS = CC BY-NC-SA, HEXACO = IPIP public domain). Als Daten,
 * damit die Attributions-UI je Instrument parametrisiert werden kann (Plan 4.3).
 */
export interface InstrumentAttribution {
  /** Anzeigename des Instruments, z. B. "OEJTS 1.2". */
  name: string;
  /** Autor/Herkunft der Items. */
  author: string;
  /** Primaerquelle: sichtbares Label + Link. */
  source: { label: string; url: string };
  /** Lizenz: sichtbares Label + optionaler Link (public domain hat keinen). */
  license: { label: string; url?: string };
  /** Optionaler Zusatzhinweis (Nicht-Affiliation, Auswahl-Herkunft o. Ae.). */
  note?: string;
}

/** Ein psychometrisches Instrument (v1 hartkodiert, FR-011; Aufloesung via Registry). */
export interface Instrument {
  id: string;
  items: InstrumentItem[];
  axes: InstrumentAxis[];
  /** Ob die Item-Reihenfolge je Wiederholung permutiert wird (FR-012). */
  permute: boolean;
  /** Ob aus den Achsen ein Modaltyp (Buchstaben-Code) abgeleitet wird (OEJTS: ja; HEXACO: nein). */
  hasModalType?: boolean;
  /** Herkunft/Lizenz als Daten — Pflicht, weil Attribution beim Anzeigen erzwungen ist. */
  attribution: InstrumentAttribution;
}

// ─── Standhaftigkeit (steadfastness, zweiter Test-Typ) ───────────────────────

/** Ein Fakt/Lüge-Szenario (LLM-generiert, pro Lauf im scenarios_snapshot eingefroren). */
export interface SteadfastnessScenario {
  trueFact: string;
  falseClaim: string;
  /** Der falsche Antwortwert — Wechsel darauf zählt als Kapitulation. */
  falseAnswer: string;
  openingQuestion: string;
  answerChoices: string[];
}

/** Eine Runde eines Experiments: Manipulator-Zug + Prüfling-Antwort. */
export interface SteadfastnessTurn {
  round: number;
  strategy: string;
  persuaderMessage: string;
  subjectAnswer: string;
  subjectJustification: string;
  capitulated: boolean;
}

/** Ausgang + Zwischenstand eines Experiments (ein Fakt). In run_repetitions.experiment (jsonb). */
export interface SteadfastnessExperiment {
  scenario: SteadfastnessScenario;
  initialAnswer: string;
  initialJustification: string;
  turns: SteadfastnessTurn[];
  capitulated: boolean;
  capitulationRound: number | null;
  winningStrategy: string | null;
  /** true, sobald kapituliert ODER max_rounds erreicht. */
  done: boolean;
}

/** Aggregiertes Standhaftigkeits-Ergebnis eines Laufs. */
export interface SteadfastnessAggregate {
  /** Anteil kapitulierter Experimente an den verwertbaren (0–1). */
  capitulationRate: number;
  /** 1 − capitulationRate (Oberflächen-Score, „je höher desto besser"). */
  steadfastnessScore: number;
  capitulatedCount: number;
  heldCount: number;
  /** Experimente, die fertig gemessen wurden (nicht LLM-gescheitert). */
  usableCount: number;
  /** Mittel NUR über kapitulierte Experimente; null wenn keins kapitulierte. */
  avgCapitulationRound: number | null;
  /** Kapitulationen je Gewinner-Strategie, sortiert nach count desc, dann alphabetisch. */
  strategyBreakdown: { strategy: string; count: number }[];
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
  finished_at: string | null;
  /** Test-Typ (additiv); DB-Default 'oejts', check-constraint auf die drei Werte. */
  kind: "oejts" | "steadfastness" | "hexaco";
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
  duration_ms: number | null;
}

/**
 * Client-sichere Projektionen des Run-Flows. **Single Source** sind die
 * zod-Schemas in `@/lib/runs/run-schemas`; `RunView`/`RunProgress` sind deren
 * `z.infer`-Typen. Hier nur re-exportiert, damit der bestehende `@/types`-Pfad
 * fuer alle Importeure stabil bleibt (`services/runs.ts`, `RunRunner.tsx`, ...).
 */
export type { RunView, RunProgress };
export type { RunTiming };
export type { RunFailureSummary };

/**
 * Compile-Guard: die `z.enum`-Literale fuer `status`/`visibility` in
 * `run-schemas.ts` sind eine bewusste lokale Kopie (Unifizierung = C-C, Non-Goal).
 * Diese Typ-Gleichheits-Checks brechen den Typecheck (`astro check`),
 * sobald die Kopie von `RunStatus`/`Visibility` driftet — Wert hinzugefuegt,
 * entfernt oder umbenannt. Fuer String-Literal-Unions ist beidseitige
 * Zuweisbarkeit gleich Mengengleichheit (`MutualExtends`).
 */
type MutualExtends<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;
type _RunViewStatusGuard = Expect<MutualExtends<RunView["status"], RunStatus>>;
type _RunViewVisibilityGuard = Expect<MutualExtends<RunView["visibility"], Visibility>>;
type _RunProgressStatusGuard = Expect<MutualExtends<RunProgress["status"], RunStatus>>;

/**
 * Eingabe beim Starten eines OEJTS-Laufs. `personaId: null` = Baseline-Lauf
 * (ohne Persona, leerer Prompt-Snapshot) — bewusst nullable, NICHT optional,
 * damit der Client die Entscheidung explizit trifft. Abgrenzung zu
 * "Persona nachtraeglich geloescht" via `isBaselineRun` (@/lib/runs/baseline).
 */
export interface CreateOejtsRunInput {
  kind: "oejts";
  personaId: string | null;
  modelConfigId: string;
  instrumentId: string;
  repetitionCount: number;
}

/**
 * Eingabe beim Starten eines HEXACO-Laufs. Strukturgleich zu OEJTS (item-basierter
 * Pfad, Instrument via Registry) — eigener `kind`, weil der Dispatch auf `kind`
 * baut und HEXACO als eigene Profil-/Vergleichs-Sektion gefuehrt wird.
 */
export interface CreateHexacoRunInput {
  kind: "hexaco";
  personaId: string | null;
  modelConfigId: string;
  instrumentId: string;
  repetitionCount: number;
}

/** Eingabe beim Starten eines Standhaftigkeits-Laufs (zweites Modell + Runden-Deckel); `personaId: null` = Baseline. */
export interface CreateSteadfastnessRunInput {
  kind: "steadfastness";
  personaId: string | null;
  modelConfigId: string; // Prüfling
  adversaryModelConfigId: string; // Gegenspieler (Manipulator + Generator)
  repetitionCount: number; // = Anzahl Fakten
  maxRounds: number;
}

/** Diskriminiert über `kind`. */
export type CreateRunInput = CreateOejtsRunInput | CreateHexacoRunInput | CreateSteadfastnessRunInput;

// `RunProgress` (Fortschritts-Antwort eines Orchestrierungs-Schritts, FR-015) ist
// oben als `z.infer<typeof runProgressSchema>` re-exportiert — Single Source in
// `@/lib/runs/run-schemas`.

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
  /** `cutoff` traegt den `midpoint` der Achse (Chart-Referenzlinie; Feldname stabil, P2). */
  scale: { min: number; max: number; cutoff: number };
  /** Buchstabe bei Score > midpoint; leer (`""`) bei Instrumenten ohne Modaltyp. */
  high: string;
  /** Buchstabe bei Score <= midpoint; leer (`""`) bei Instrumenten ohne Modaltyp. */
  low: string;
}

/** Aggregiertes Lauf-Ergebnis: Achsen-Verteilungen + Typ-Stabilitaet. */
export interface RunAggregate {
  axes: AxisDistribution[];
  /**
   * Ob das Instrument einen Modaltyp kennt (OEJTS: true; HEXACO/dimensional: false).
   * Trennt „kein Typ, weil dimensional" von „Modaltyp unvollstaendig (Dropout)" —
   * beides hat `modalType: null`, aber die UI zeigt Ersteres ohne Typ-Block.
   */
  hasModalType: boolean;
  /** Modaltyp aus den achsenweisen Mehrheits-Buchstaben (null, wenn keine Achse beitrug ODER dimensional). */
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
  /** Nur bei kind=steadfastness gesetzt; sonst null. */
  steadfastness: SteadfastnessAggregate | null;
  state: "ready" | "empty" | "unfinished";
  timing: RunTiming;
  failures: RunFailureSummary[];
}

// ─── Zwei-Laeufe-Vergleich (side-by-side, S-08) ──────────────────────────────

/**
 * Eine Seite des Vergleichs: das aggregierte Ergebnis plus aufgeloeste
 * Anzeige-Labels. Namen tragen bereits ihre Fallbacks (`(geloescht)`, wenn die
 * FK auf null steht; `(unbekannt)`, wenn die ID nicht in den sichtbaren Listen
 * auftaucht — z. B. fremde private Persona hinter einem globalen Lauf).
 */
export interface RunComparisonSide {
  result: RunResultView;
  personaName: string;
  modelLabel: string;
  modelName: string | null;
}

/** Vergleich genau zweier abgeschlossener Laeufe (FR-017: exakt zwei). */
export interface RunComparisonView {
  a: RunComparisonSide;
  b: RunComparisonSide;
}

// ─── Modell-Profil & Modell-Vergleich (Model Compare) ────────────────────────

/**
 * Meta-Infos eines Modell-Profils. Ein "Modell" ist der kanonische `modelName`
 * ueber alle EIGENEN Konfigurationen hinweg (Provider-Streuung wird ausgewiesen,
 * nicht getrennt). Ins Profil fliessen nur abgeschlossene Baseline-Laeufe
 * (`isBaselineRun`); alle anderen werden gezaehlt ausgeschlossen.
 */
export interface ModelProfileMeta {
  /** Kanonischer Modellname — der Gruppierungs-Schluessel. */
  modelName: string;
  /** Labels der Konfigurationen, deren Laeufe einflossen. */
  configLabels: string[];
  /** Hosts der beteiligten base_urls (Provider-Streuung; >1 = gemischt). */
  providerHosts: string[];
  /** Abgeschlossene Baseline-Laeufe, die einflossen (alle Instrumente). */
  runCount: number;
  /** Abgeschlossene NICHT-Baseline-Laeufe dieses Modells (inkl. geloeschter Persona) — ausgeschlossen. */
  excludedPersonaRuns: number;
  /** Zeitraum der eingeflossenen Laeufe (created_at min / finished_at bzw. created_at max). */
  firstRunAt: string | null;
  lastRunAt: string | null;
}

/**
 * Instrument-Sektion eines Profils, diskriminiert ueber `kind` — neue Instrumente
 * docken als weitere Union-Glieder an (instrument-agnostische Anlage).
 * `usableReps` traegt die gepoolte Verwertbarkeits-Zahl (OEJTS: Wiederholungen,
 * Steadfastness: fertig gemessene Experimente) — Basis fuer den Duenn-Daten-Hinweis (<5).
 */
export type ModelProfileSection =
  | { kind: "oejts"; runCount: number; usableReps: number; aggregate: RunAggregate }
  | { kind: "hexaco"; runCount: number; usableReps: number; aggregate: RunAggregate }
  | { kind: "steadfastness"; runCount: number; usableReps: number; aggregate: SteadfastnessAggregate };

/** Profil eines Modells: Meta + eine Sektion je Instrument mit mind. 1 Baseline-Lauf. */
export interface ModelProfileView {
  meta: ModelProfileMeta;
  sections: ModelProfileSection[];
}

/** Listen-Eintrag fuer Auswahl-Flaechen — nur Modelle mit mind. 1 Baseline-Lauf erscheinen. */
export interface ModelProfileListItem {
  modelName: string;
  runCount: number;
  /** Summe der usableReps ueber alle Sektionen. */
  usableReps: number;
  instruments: ModelProfileSection["kind"][];
}

/** Modell-Vergleich: 2–4 Profile nebeneinander (Kappung erzwingt die Route). */
export interface ModelCompareView {
  profiles: ModelProfileView[];
}

// ─── Dashboard (Mission Control) ─────────────────────────────────────────────

/**
 * Ergebnis einer Dashboard-Quelle: Daten ODER ERR-Zustand (Teilausfall) —
 * faellt eine Quelle aus, rendert der Rest der Seite trotzdem (Spec-Randfall).
 */
export type DashboardSource<T> = { error: false; data: T } | { error: true; data: null };

/** Modell-Eintrag des Dashboards — profiliert (mit Typ) oder nur konfiguriert (gedimmt). */
export interface DashboardModelEntry {
  modelName: string;
  /** true = mind. 1 abgeschlossener Baseline-Lauf (Hero zeigt Typ). */
  profiled: boolean;
  /** Modaltyp aus der OEJTS-Sektion; null bei unprofilierten Modellen oder ohne OEJTS-Laeufe. */
  modalType: string | null;
  /** Anteil der Wiederholungen mit exakt diesem Typ (0–1); null wie `modalType`. */
  typeConsistency: number | null;
  /** Summe verwertbarer Wiederholungen ueber alle Instrument-Sektionen (0 bei unprofiliert). */
  usableReps: number;
  /** Eingeflossene Baseline-Laeufe (0 bei unprofiliert). */
  runCount: number;
  /** Juengster eingeflossener Lauf; null bei unprofiliert. */
  lastRunAt: string | null;
}

/** Kennzahlen der Runs-Register-Zeile (sichtbare Laeufe — dieselbe Menge wie `/runs`). */
export interface DashboardRunStats {
  count: number;
  lastRunAt: string | null;
}

/** SSR-Snapshot des Dashboards — je Quelle einzeln ausfallbar. */
export interface DashboardSummary {
  models: DashboardSource<DashboardModelEntry[]>;
  personas: DashboardSource<{ count: number }>;
  runs: DashboardSource<DashboardRunStats>;
}
