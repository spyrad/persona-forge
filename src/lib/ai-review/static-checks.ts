/**
 * Deterministische Regel-Pruefungen direkt am Diff.
 *
 * **Warum das hier und nicht im Prompt.** Gemessen (2026-07-09, glm-5.2,
 * `temperature: 0`): eine Migration mit vorbildlichen Policies, der nur das
 * `enable row level security` fehlte, wurde in **1 von 3** Laeufen als sauber
 * durchgewunken. Eine praezisere Regel-Beschreibung im Prompt verschlimmerte es
 * auf **0 von 5** erkannt. Ein Falsch-Negativ bei einem Sicherheits-Check ist
 * das teuerste Versagen, das dieses Werkzeug haben kann.
 *
 * "Steht zu jedem `create table` ein `enable row level security`?" ist eine
 * syntaktische Eigenschaft des Diffs. Ein Regex entscheidet sie mit 100 %
 * Trefferquote, kostet keine Tokens und ist unit-testbar. Wer eine Frage
 * abzaehlen kann, soll sie nicht einem Sprachmodell stellen.
 *
 * Das Modell beurteilt weiterhin, was Kontext braucht (`logic-in-route`,
 * `undeclared-change`, `missing-auth-guard`, ...) — siehe `detector` in
 * `schema.ts`.
 *
 * Bewusst rein: kein `process`, kein Netz.
 */
import { splitFiles, type DiffFile } from "@/lib/ai-review/diff";
import type { Finding } from "@/lib/ai-review/schema";

/** Nur hinzugefuegte Zeilen, ohne das `+`-Praefix. Metazeilen (`+++`) fliegen raus. */
function addedLines(file: DiffFile): string[] {
  return file.body
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function isMigration(path: string): boolean {
  return path.startsWith("supabase/migrations/") && path.endsWith(".sql");
}

function isApiRoute(path: string): boolean {
  return path.startsWith("src/pages/api/") && path.endsWith(".ts");
}

/** Neu angelegte Datei — erkennbar an der `new file mode`-Metazeile. */
function isNewFile(file: DiffFile): boolean {
  return /^new file mode /m.test(file.body);
}

function isGeneratedUiComponent(path: string): boolean {
  return path.startsWith("src/components/ui/");
}

/** Kuerzt einen Beleg auf eine handliche Laenge. */
function evidence(line: string): string {
  const trimmed = line.trim();
  return trimmed.length <= 160 ? trimmed : `${trimmed.slice(0, 159)}…`;
}

// --- Datensicherheit ------------------------------------------------------

const CREATE_TABLE = /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_.]+)"?/i;
const ENABLE_RLS = /^\s*alter\s+table\s+"?([a-z0-9_.]+)"?\s+enable\s+row\s+level\s+security/i;
const CREATE_INDEX_ON = /^\s*create\s+(?:unique\s+)?index\s+\S+\s+on\s+"?([a-z0-9_.]+)"?\s*\(([^)]*)\)/i;

/** `create policy … for all` oder eine Policy mit `using (true)`. */
const POLICY_FOR_ALL = /^\s*create\s+policy\b[^;]*\bfor\s+all\b/i;
const USING_TRUE = /\busing\s*\(\s*true\s*\)/i;

/** Nacktes `auth.uid()`, das nicht in `(select auth.uid())` steht. */
const BARE_AUTH_UID = /(?<!select\s{0,4})\bauth\.uid\s*\(\s*\)/i;

function checkMigrations(files: DiffFile[]): Finding[] {
  const migrations = files.filter((f) => isMigration(f.path));
  if (migrations.length === 0) return [];

  const findings: Finding[] = [];

  // RLS-Aktivierung und Indizes duerfen in einer ANDEREN Migration des Diffs
  // stehen — deshalb erst alle Zeilen sammeln, dann pro Tabelle urteilen.
  const enabledTables = new Set<string>();
  const indexedColumns = new Map<string, Set<string>>();

  for (const file of migrations) {
    for (const line of addedLines(file)) {
      const rls = ENABLE_RLS.exec(line);
      if (rls?.[1]) enabledTables.add(rls[1].toLowerCase());

      const index = CREATE_INDEX_ON.exec(line);
      if (index?.[1] && index[2]) {
        const table = index[1].toLowerCase();
        const columns = index[2].split(",").map((c) => c.trim().replace(/"/g, "").toLowerCase());
        const existing = indexedColumns.get(table) ?? new Set<string>();
        columns.forEach((c) => existing.add(c));
        indexedColumns.set(table, existing);
      }
    }
  }

  for (const file of migrations) {
    const lines = addedLines(file);

    for (const [index, line] of lines.entries()) {
      const created = CREATE_TABLE.exec(line);
      if (created?.[1]) {
        const table = created[1].toLowerCase();

        if (!enabledTables.has(table)) {
          findings.push({
            rule: "missing-rls",
            file: file.path,
            evidence: `${evidence(line)} — kein "alter table ${table} enable row level security" im Diff`,
          });
        }

        // Hat die Tabelle eine owner_id-Spalte, aber keinen Index darauf?
        const body = lines.slice(index).join("\n");
        const columnBlock = body.slice(0, body.indexOf(");") + 1);
        if (/\bowner_id\b/i.test(columnBlock) && !indexedColumns.get(table)?.has("owner_id")) {
          findings.push({
            rule: "missing-owner-index",
            file: file.path,
            evidence: `Tabelle "${table}" hat owner_id, aber keinen Index darauf`,
          });
        }
      }

      if (POLICY_FOR_ALL.test(line) || (/^\s*create\s+policy\b/i.test(line) && USING_TRUE.test(line))) {
        findings.push({ rule: "blanket-policy", file: file.path, evidence: evidence(line) });
      }

      // `using (true)` kann auch auf einer Folgezeile der Policy stehen.
      if (!/^\s*create\s+policy\b/i.test(line) && USING_TRUE.test(line)) {
        findings.push({ rule: "blanket-policy", file: file.path, evidence: evidence(line) });
      }

      if (BARE_AUTH_UID.test(line) && !/\(\s*select\s+auth\.uid\s*\(\s*\)\s*\)/i.test(line)) {
        findings.push({ rule: "uncached-auth-uid", file: file.path, evidence: evidence(line) });
      }
    }
  }

  return findings;
}

// --- API-Routen -----------------------------------------------------------

const PRERENDER_FALSE = /^\s*export\s+const\s+prerender\s*=\s*false/;
const LOWERCASE_HANDLER = /^\s*export\s+const\s+(get|post|put|patch|delete)\s*[:=]/;

function checkApiRoutes(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files.filter((f) => isApiRoute(f.path))) {
    const lines = addedLines(file);

    for (const line of lines) {
      const handler = LOWERCASE_HANDLER.exec(line);
      if (handler) {
        findings.push({
          rule: "lowercase-handler",
          file: file.path,
          evidence: `${evidence(line)} — muss ${handler[1].toUpperCase()} heissen`,
        });
      }
    }

    // Nur bei NEUEN Routen urteilen: bei einer Aenderung an einer bestehenden
    // Route steht `prerender = false` womoeglich ausserhalb des Diff-Hunks.
    if (isNewFile(file) && !lines.some((line) => PRERENDER_FALSE.test(line))) {
      findings.push({
        rule: "missing-prerender",
        file: file.path,
        evidence: "Neue API-Route ohne `export const prerender = false`",
      });
    }
  }

  return findings;
}

// --- UI-Konventionen ------------------------------------------------------

/**
 * Farb-Literale in Klassen-Strings. Bewusst eng gefasst: Tailwind-Farbfamilien
 * mit numerischer Stufe (`text-blue-400`), Schwarz/Weiss, und Gradient-Utilities.
 * Semantische Tokens (`text-foreground`, `bg-muted`) matchen nicht.
 */
const COLOR_LITERAL =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b|\bbg-gradient-to-[a-z]+\b/;

function checkUi(files: DiffFile[]): Finding[] {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".tsx") && !file.path.endsWith(".astro")) continue;
    // Generierte shadcn/ui-Komponenten duerfen Farb-Literale enthalten.
    if (isGeneratedUiComponent(file.path)) continue;

    for (const line of addedLines(file)) {
      if (COLOR_LITERAL.test(line)) {
        findings.push({ rule: "color-literal", file: file.path, evidence: evidence(line) });
      }
    }
  }

  return findings;
}

// --- Zusammenfuehrung -----------------------------------------------------

/** Entfernt Doppelmeldungen derselben Regel in derselben Datei. */
function dedupe(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.rule}::${f.file}::${f.evidence}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Prueft alle `detector: "static"`-Regeln am **rohen** Diff.
 *
 * Bewusst am Roh-Diff, nicht am gekappten: eine Migration, die dem
 * Zeichen-Budget zum Opfer fiele, wuerde sonst ungeprueft durchrutschen.
 */
export function staticFindings(rawDiff: string): Finding[] {
  const files = splitFiles(rawDiff);
  return dedupe([...checkMigrations(files), ...checkApiRoutes(files), ...checkUi(files)]);
}
