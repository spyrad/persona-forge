/**
 * zod-Schema der sechs Review-Kriterien (CI-Review-Agent, Champion-Projekt M5L3).
 *
 * Dieses Modul ist die **Single Source** der Kriterien-Namen: Prompt-Bau
 * (`prompt.ts`), Verdict-Schwelle (`verdict.ts`) und das Kommentar-Rendering
 * lesen alle `CRITERIA` bzw. den abgeleiteten Typ, statt Strings zu duplizieren.
 *
 * Das Schema wird dem LLM per `Output.object` als Struktur-Vorgabe gereicht.
 * Die Kriterien-Definitionen samt "1"-/"10"-Zustand stehen kanonisch in
 * `context/changes/ci-review-agent/requirements.md`.
 *
 * Bewusst rein: kein `process`, kein Netz, kein `astro:env` — dieses Modul laeuft
 * sowohl unter Vitest als auch unter plain `tsx` im CI.
 */
import { z } from "zod";

/**
 * Die sechs Kriterien in fester Reihenfolge. Reihenfolge ist Teil des Vertrags:
 * Prompt und PR-Kommentar praesentieren sie so, damit Diffs zwischen Laeufen
 * zeilenweise vergleichbar bleiben.
 */
export const CRITERIA = [
  "uiConventions",
  "apiQuartet",
  "dataSafety",
  "testCoverage",
  "scopeDiscipline",
  "architectureConsistency",
] as const;

export type Criterion = (typeof CRITERIA)[number];

/** Menschenlesbare Titel — fuer Prompt und PR-Kommentar. */
export const CRITERION_TITLES: Record<Criterion, string> = {
  uiConventions: "Konventions-Konformitaet (UI)",
  apiQuartet: "API-Route-Quartett",
  dataSafety: "Datensicherheit & RLS",
  testCoverage: "Test-Abdeckung nach Risikoklasse",
  scopeDiscipline: "Scope- & Plan-Treue",
  architectureConsistency: "Architektur- & Pattern-Konsistenz",
};

/** Score-Grenzen. Das LLM darf nur ganze Zahlen 1..10 liefern. */
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

const scoreSchema = z.object({
  score: z.number().int().min(MIN_SCORE).max(MAX_SCORE),
  /** Kurze Begruendung, die konkrete Dateien/Zeilen des Diffs nennt. */
  reasoning: z.string().min(1),
});

/**
 * Erwartete LLM-Ausgabe. Jedes Kriterium ist ein Pflichtfeld — fehlt eines,
 * schlaegt `safeParse` fehl, statt still eine Luecke als "gut" durchzuwinken.
 */
export const reviewSchema = z.object({
  criteria: z.object({
    uiConventions: scoreSchema,
    apiQuartet: scoreSchema,
    dataSafety: scoreSchema,
    testCoverage: scoreSchema,
    scopeDiscipline: scoreSchema,
    architectureConsistency: scoreSchema,
  }),
  /** Ein bis drei Saetze Gesamteindruck — Kopf des PR-Kommentars. */
  summary: z.string().min(1),
});

/** Aus dem Schema abgeleiteter Typ (Single Source). */
export type ReviewResult = z.infer<typeof reviewSchema>;
