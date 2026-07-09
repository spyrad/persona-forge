/**
 * Regel-Katalog und zod-Schema des CI-Review-Agenten (Champion-Projekt M5L3).
 *
 * **Warum Findings statt Noten.** Ein erster Entwurf liess das LLM je Kriterium
 * eine Note 1–10 vergeben. Gemessen (2026-07-09, glm-5.2, `temperature: 0`,
 * derselbe Diff dreimal): `apiQuartet` schwankte zwischen 3 und 8, und das
 * Verdict kippte von `failed` auf `passed`. Eine deterministische Schwelle auf
 * einer gewuerfelten Zahl ist Scheinsicherheit.
 *
 * Deshalb extrahiert das Modell jetzt nur noch **Fakten**: welche Regel wurde
 * in welcher Datei verletzt. Ob `export const prerender = false` fehlt, ist
 * abzaehlbar. Schweregrad und Score leitet `verdict.ts` daraus im Code ab —
 * das LLM benotet nicht mehr.
 *
 * Bewusst rein: kein `process`, kein Netz, kein `astro:env`.
 */
import { z } from "zod";

/**
 * Die sechs Kriterien in fester Reihenfolge. Reihenfolge ist Teil des Vertrags:
 * Prompt und PR-Kommentar praesentieren sie so, damit Laeufe zeilenweise
 * vergleichbar bleiben.
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

/**
 * Schweregrad. Wird **nicht** vom Modell geliefert, sondern aus der Regel
 * abgeleitet — sonst waere die Subjektivitaet nur eine Ebene tiefer gerutscht.
 */
export type Severity = "critical" | "warning" | "observation";

/**
 * Wer die Regel prueft.
 *
 * `static` = syntaktisch am Diff entscheidbar, wird in `static-checks.ts` per
 * Regex geprueft und **nicht** ins Modell gegeben. Gemessen (2026-07-09):
 * glm-5.2 uebersah `missing-rls` in 1 von 3 Laeufen — ein Falsch-Negativ bei
 * einem Sicherheits-Check. Eine praezisere Prompt-Beschreibung machte es
 * schlimmer (0 von 5 erkannt). Wer eine Frage abzaehlen kann, soll sie nicht
 * einem Sprachmodell stellen.
 *
 * `llm` = braucht Kontext oder Urteilsvermoegen (steckt Logik in der Route?
 * kuendigt der PR-Body die Aenderung an?).
 */
export type Detector = "static" | "llm";

export interface RuleSpec {
  criterion: Criterion;
  severity: Severity;
  detector: Detector;
  /** Was das Modell suchen soll — wird woertlich in den Prompt gerendert (nur `llm`). */
  description: string;
}

/**
 * Der Regel-Katalog. Jede Regel ist im Diff objektiv nachweisbar; das Modell
 * darf ausschliesslich aus diesen IDs waehlen (`z.enum`), nichts erfinden.
 *
 * `critical` = blockt allein (Score faellt unter die Einzelschwelle).
 */
export const RULES = {
  // --- 1. Konventions-Konformitaet (UI) ---
  "color-literal": {
    criterion: "uiConventions",
    severity: "warning",
    detector: "static",
    description: "Farb-Literal statt semantischem Token (text-white, bg-white/10, *-blue-*, Gradient-Headline)",
  },
  "manual-class-concat": {
    criterion: "uiConventions",
    severity: "observation",
    detector: "llm",
    description: "Tailwind-Klassen per String-Konkatenation gemerged statt mit cn()",
  },
  "needless-client-load": {
    criterion: "uiConventions",
    severity: "warning",
    detector: "llm",
    description: "client:load auf einer Komponente ohne State, Effect, Handler oder Browser-API",
  },

  // --- 2. API-Route-Quartett ---
  "missing-prerender": {
    criterion: "apiQuartet",
    severity: "warning",
    detector: "static",
    description: "API-Route ohne `export const prerender = false`",
  },
  "lowercase-handler": {
    criterion: "apiQuartet",
    severity: "warning",
    detector: "static",
    description: "HTTP-Handler in Kleinschreibung exportiert (get/post statt GET/POST)",
  },
  "missing-input-validation": {
    criterion: "apiQuartet",
    severity: "critical",
    detector: "llm",
    description: "Request-Body oder Query wird ohne zod-safeParse verwendet",
  },
  "missing-auth-guard": {
    criterion: "apiQuartet",
    severity: "critical",
    detector: "llm",
    description: "Geschuetzte API-Route ohne requireUser",
  },

  // --- 3. Datensicherheit & RLS ---
  "missing-rls": {
    criterion: "dataSafety",
    severity: "critical",
    detector: "static",
    description: "Neue Tabelle ohne `enable row level security`",
  },
  "blanket-policy": {
    criterion: "dataSafety",
    severity: "critical",
    detector: "static",
    description: "RLS-Policy als `for all` oder mit `using (true)` statt granular je Operation und Rolle",
  },
  "uncached-auth-uid": {
    criterion: "dataSafety",
    severity: "observation",
    detector: "static",
    description: "Nacktes auth.uid() in einer Policy statt (select auth.uid())",
  },
  "missing-owner-index": {
    criterion: "dataSafety",
    severity: "observation",
    detector: "static",
    description: "Neue Tabelle mit owner_id, aber ohne Index darauf",
  },
  "hardcoded-secret": {
    criterion: "dataSafety",
    severity: "critical",
    detector: "llm",
    description: "Schluessel, Token oder Passwort im Klartext im Code",
  },
  "unguarded-external-url": {
    criterion: "dataSafety",
    severity: "critical",
    detector: "llm",
    description: "Externe URL wird ohne isPublicHttpsUrl aufgerufen (SSRF)",
  },

  // --- 4. Test-Abdeckung nach Risikoklasse ---
  "missing-test-for-risky-change": {
    criterion: "testCoverage",
    severity: "warning",
    detector: "llm",
    description: "Sicherheits- oder DB-nahe Aenderung ohne zugehoerigen Test im Diff",
  },
  "wrong-test-glob": {
    criterion: "testCoverage",
    severity: "warning",
    detector: "llm",
    description:
      "Test im falschen Glob (*.test.ts, der Supabase braucht — gehoert als *.itest.ts nach src/test/integration/)",
  },

  // --- 5. Scope- & Plan-Treue ---
  "undeclared-change": {
    criterion: "scopeDiscipline",
    severity: "warning",
    detector: "llm",
    description: "Der Diff enthaelt Umbauten, die PR-Titel und -Body nicht ankuendigen",
  },

  // --- 6. Architektur- & Pattern-Konsistenz ---
  "logic-in-route": {
    criterion: "architectureConsistency",
    severity: "warning",
    detector: "llm",
    description: "Business-Logik direkt in der API-Route statt in src/lib/services/",
  },
  "duplicated-type": {
    criterion: "architectureConsistency",
    severity: "observation",
    detector: "llm",
    description: "Shared Type lokal dupliziert statt in src/types.ts",
  },
  "duplicated-helper": {
    criterion: "architectureConsistency",
    severity: "observation",
    detector: "llm",
    description: "Vorhandener Helper per Copy-Paste nachgebaut statt wiederverwendet",
  },
} as const satisfies Record<string, RuleSpec>;

export type RuleId = keyof typeof RULES;

export const RULE_IDS = Object.keys(RULES) as [RuleId, ...RuleId[]];

/** Regel-IDs, die `static-checks.ts` selbst am Diff prueft. */
export const STATIC_RULE_IDS = RULE_IDS.filter((id) => RULES[id].detector === "static");
/** Regel-IDs, nach denen das Modell suchen soll. */
export const LLM_RULE_IDS = RULE_IDS.filter((id) => RULES[id].detector === "llm");

/**
 * Regeln eines Kriteriums fuer den Prompt-Katalog — **nur die `llm`-Regeln**.
 * Statische Regeln dem Modell zu zeigen, hiesse es nach etwas zu fragen, das der
 * Code schon sicher weiss; es wuerde nur Duplikate und Rauschen erzeugen.
 */
export function rulesFor(criterion: Criterion): RuleId[] {
  return LLM_RULE_IDS.filter((id) => RULES[id].criterion === criterion);
}

const findingSchema = z.object({
  /** Muss aus dem Katalog stammen — kein Freitext. */
  rule: z.enum(RULE_IDS),
  /** Betroffener Pfad, genau wie im Diff. */
  file: z.string().min(1),
  /** Woertliches Zitat oder knappe Beschreibung der Fundstelle. */
  evidence: z.string().min(1),
});

export type Finding = z.infer<typeof findingSchema>;

/**
 * Erwartete LLM-Ausgabe. Keine Scores: ein sauberer Diff liefert schlicht ein
 * leeres `findings`-Array. Damit verschwindet auch das Falsch-Positiv-Problem —
 * "Kriterium nicht beruehrt" und "Kriterium erfuellt" fuehren beide zu keinem
 * Finding und damit zu voller Punktzahl.
 */
export const reviewSchema = z.object({
  findings: z.array(findingSchema),
  /** Ein bis drei Saetze Gesamteindruck — Kopf des PR-Kommentars. */
  summary: z.string().min(1),
});

export type ReviewResult = z.infer<typeof reviewSchema>;
