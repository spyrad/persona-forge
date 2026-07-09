/**
 * Prompt-Bau fuer den CI-Review-Agenten.
 *
 * Der Regel-Katalog wird aus `RULES` gerendert — Prompt und Schema koennen
 * nicht auseinanderlaufen. Das Modell waehlt nur aus den vorgegebenen Regel-IDs
 * und belegt jede mit einer Datei aus dem Diff; Noten vergibt es keine mehr
 * (siehe `schema.ts` zur Begruendung).
 *
 * Notwendig, weil der z.ai-Coding-Endpunkt `response_format: json_schema` NICHT
 * unterstuetzt (nur `json_object`). Das SDK kann dem Modell das Schema also gar
 * nicht uebermitteln — `Output.object` validiert nur nachtraeglich. Ohne die
 * Formvorgabe im Prompt erfindet GLM eigene Feldnamen.
 *
 * Bewusst rein: kein `process`, kein Netz.
 */
import { CRITERIA, CRITERION_TITLES, RULES, rulesFor } from "@/lib/ai-review/schema";

/** Der Regel-Katalog, nach Kriterium gruppiert. */
const RULE_CATALOG = CRITERIA.map((criterion, index) => {
  const rules = rulesFor(criterion)
    .map((id) => `  - "${id}": ${RULES[id].description}`)
    .join("\n");
  return `${index + 1}. ${CRITERION_TITLES[criterion]}\n${rules}`;
}).join("\n\n");

const SCHEMA_HINT = `{
  "findings": [
    { "rule": "<eine der Regel-IDs oben>", "file": "<Pfad aus dem Diff>", "evidence": "<Zitat oder knappe Fundstelle>" }
  ],
  "summary": "<ein bis drei Saetze Gesamteindruck>"
}`;

/**
 * System-Prompt. In AI SDK 7 gehoert er in `instructions` — `role: "system"`
 * in `messages` wird per Default als Prompt-Injection-Risiko abgelehnt.
 */
export const REVIEW_INSTRUCTIONS = `Du bist ein Code-Reviewer fuer das Repository "persona-forge"
(Astro 6 SSR + React 19 Islands + TypeScript + Tailwind 4 + Supabase + Cloudflare Workers).

Du bist ein SEMANTISCHER Linter. Du suchst ausschliesslich nach Verstoessen gegen den
Regel-Katalog unten — projektspezifische Konventionen, die ein Linter nicht pruefen kann.

DEINE AUFGABE: Finde Regel-Verstoesse im Diff. Vergib KEINE Noten und KEINE Bewertungen.
Fuer jeden Verstoss lieferst du die Regel-ID, die betroffene Datei und einen Beleg aus dem Diff.

HARTE REGELN:
- Melde einen Verstoss NUR, wenn der Diff die Stelle zeigt. Bewerte nie die Abwesenheit von Code.
  Legt der Diff keine Migration an, gibt es keinen RLS-Verstoss — nicht "fehlende RLS" melden.
  Aendert der Diff keine API-Route, gibt es keinen Quartett-Verstoss.
- Jedes Finding braucht eine Datei aus dem Diff und einen konkreten Beleg (Zitat).
- Erfinde keine Regel-IDs. Nutze ausschliesslich die IDs aus dem Katalog.
- Ein sauberer Diff liefert ein leeres findings-Array. Das ist der Normalfall, kein Fehler.
- Dieselbe Regel darf mehrfach vorkommen, wenn mehrere Dateien sie verletzen.

NICHT melden (mechanisch bereits abgedeckt, jede Erwaehnung ist Rauschen):
- Typ-Sicherheit, \`any\`, floating promises (typescript-eslint strictTypeChecked)
- Formatierung, Zeilenlaenge, Anfuehrungszeichen (Prettier)
- React-Hook-Regeln, Memoization (react-compiler, react-hooks)
- Barrierefreiheits-Basics (jsx-a11y)
- Fehlende Semikolons, unbenutzte Variablen, console.log
- Fehlende RLS-Aktivierung, Sammelpolicies, nacktes auth.uid(), fehlender owner_id-Index,
  fehlendes \`prerender = false\`, kleingeschriebene HTTP-Handler, Farb-Literale
  — diese Regeln prueft der Reviewer bereits deterministisch im Code.

Generierte shadcn/ui-Komponenten unter src/components/ui/ sind von den UI-Konventionen
ausgenommen.

REGEL-KATALOG:

${RULE_CATALOG}

ANTWORTFORMAT — antworte AUSSCHLIESSLICH mit einem JSON-Objekt in exakt dieser Form:
${SCHEMA_HINT}
Keine zusaetzlichen Felder, kein Markdown, kein Fliesstext ausserhalb des JSON.`;

export interface PromptInput {
  title: string;
  body: string;
  diff: string;
  /** True, wenn `prepareDiff` Dateien verworfen oder angeschnitten hat. */
  truncated: boolean;
  /** Pfade, die es nicht in den Diff geschafft haben. */
  droppedFiles: string[];
}

/**
 * Baut den User-Prompt. War der Diff gekappt, sagt der Prompt das ausdruecklich —
 * sonst deutet das Modell eine fehlende Testdatei als fehlenden Test
 * ("missing-test-for-risky-change") und bestraft den PR fuer eine
 * Budget-Entscheidung, die er nicht getroffen hat.
 */
export function buildPrompt({ title, body, diff, truncated, droppedFiles }: PromptInput): string {
  const parts: string[] = [
    `PR-TITEL:\n${title.trim() || "(kein Titel)"}`,
    `PR-BESCHREIBUNG:\n${body.trim() || "(keine Beschreibung)"}`,
  ];

  if (truncated) {
    const dropped = droppedFiles.length > 0 ? `\nNicht enthalten: ${droppedFiles.join(", ")}` : "";
    parts.push(
      "HINWEIS: Der Diff wurde aus Budgetgruenden gekuerzt. Die fuer die Regeln relevantesten " +
        "Dateien stehen zuerst. Melde NUR Verstoesse, die du im gezeigten Diff belegen kannst, " +
        "und leite aus fehlenden Dateien keine Verstoesse ab (insbesondere keine zur Test-Abdeckung)." +
        dropped,
    );
  }

  parts.push(`GIT DIFF:\n${diff || "(leerer Diff)"}`);

  return parts.join("\n\n---\n\n");
}
