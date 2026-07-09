/**
 * Diff-Aufbereitung fuer den CI-Review-Agenten.
 *
 * Wandelt einen rohen `git diff` in einen budgetierten Text, der die fuer die
 * sechs Kriterien relevanten Dateien bevorzugt. Drei Schritte in **fester
 * Reihenfolge**:
 *
 *   1. Rausch-Dateien verwerfen (Lockfiles, Build-Output, Snapshots, Binaries)
 *   2. Rest nach Kriterien-Relevanz sortieren (Migrationen zuerst)
 *   3. Auf ein Zeichen-Budget kappen
 *
 * Die Reihenfolge ist der Kern: wird zuerst gekappt, verdraengt ein
 * `package-lock.json`-Update am Anfang des Diffs die RLS-Migration am Ende —
 * der Reviewer bewertet dann Rauschen und meldet gruen.
 *
 * Bewusst rein: kein `fs`, kein `process`, kein Netz.
 */

/** Ein einzelner Datei-Block aus `git diff`, inklusive `diff --git`-Kopfzeile. */
interface DiffFile {
  path: string;
  body: string;
}

/** Pfade, die fuer kein Kriterium Signal tragen und nur Budget fressen. */
const NOISE_PATTERNS: RegExp[] = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)bun\.lockb$/,
  /^dist\//,
  /^node_modules\//,
  /^coverage\//,
  /^playwright-report\//,
  /^test-results\//,
  /\.snap$/,
  /\.min\.(js|css)$/,
  /\.map$/,
];

/**
 * Prioritaet je Datei — kleiner ist wichtiger. Leitet sich direkt aus den sechs
 * Kriterien ab: Migrationen tragen Kriterium 3 (RLS), API-Routen Kriterium 2,
 * Astro/TSX Kriterium 1, `src/lib` Kriterium 6.
 */
function priorityOf(path: string): number {
  if (path.startsWith("supabase/migrations/")) return 0;
  if (path.startsWith("src/pages/api/")) return 1;
  if (path.endsWith(".astro") || path.endsWith(".tsx")) return 2;
  if (isTestFile(path)) return 4; // vor src/lib pruefen: `src/lib/x.test.ts` ist ein Test
  if (path.startsWith("src/lib/")) return 3;
  return 5;
}

function isTestFile(path: string): boolean {
  return (
    path.endsWith(".test.ts") ||
    path.endsWith(".itest.ts") ||
    path.endsWith(".spec.ts") ||
    path.startsWith("tests/") ||
    path.startsWith("playwright/")
  );
}

function isNoise(path: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(path));
}

/**
 * Binaerdateien tragen kein lesbares Signal, kosten aber Zeichen.
 *
 * Geprueft werden **nur Metazeilen** — also solche ohne `+`/`-`-Praefix. Ein
 * naiver `body.includes("GIT binary patch")` verwirft sonst jede Datei, die den
 * Marker als *Inhalt* hinzufuegt: dieser Parser selbst, seine Tests, oder Doku
 * ueber Diff-Formate. Genau das passierte (2026-07-09): `diff.ts` wurde aus dem
 * eigenen Review geworfen, und der Reviewer meldete gruen, ohne sie gesehen zu
 * haben.
 */
function isBinaryBlock(body: string): boolean {
  for (const line of body.split("\n")) {
    if (line.startsWith("+") || line.startsWith("-")) continue;
    if (line.startsWith("GIT binary patch")) return true;
    if (/^Binary files .* differ$/.test(line)) return true;
  }
  return false;
}

/**
 * Zerlegt den Roh-Diff an den `diff --git`-Grenzen. Alles vor dem ersten
 * Marker (z. B. Commit-Header) wird verworfen.
 */
function splitFiles(rawDiff: string): DiffFile[] {
  const files: DiffFile[] = [];
  // (?=...) haelt die `diff --git`-Zeile am Kopf jedes Blocks.
  const blocks = rawDiff.split(/^(?=diff --git )/m);

  for (const block of blocks) {
    if (!block.startsWith("diff --git ")) continue;
    const path = extractPath(block);
    if (path === null) continue;
    files.push({ path, body: block });
  }

  return files;
}

/**
 * Zieht den Ziel-Pfad aus `diff --git a/<pfad> b/<pfad>`. Bei Loeschungen
 * zeigt die b-Seite weiterhin auf den alten Pfad, nicht auf `/dev/null`.
 * Faellt auf die a-Seite zurueck, falls die Kopfzeile untypisch aussieht.
 */
function extractPath(block: string): string | null {
  const header = block.slice(0, block.indexOf("\n"));
  const bSide = / b\/(.+)$/.exec(header);
  if (bSide?.[1]) return bSide[1];
  const aSide = /^diff --git a\/(.+?) /.exec(header);
  return aSide?.[1] ?? null;
}

export interface PreparedDiff {
  /** Der budgetierte, priorisierte Diff-Text. */
  diff: string;
  /** True, sobald mindestens eine Datei wegen Rauschen oder Budget fehlt. */
  truncated: boolean;
  /** Pfade, die es nicht in `diff` geschafft haben — Rausch und Budget-Opfer. */
  droppedFiles: string[];
}

/**
 * Bereitet einen Roh-Diff fuer den Prompt auf.
 *
 * @param rawDiff Ausgabe von `git diff <base>...<head>`
 * @param budget  Maximale Zeichenzahl des Ergebnisses
 */
export function prepareDiff(rawDiff: string, budget: number): PreparedDiff {
  const files = splitFiles(rawDiff);
  if (files.length === 0) {
    return { diff: "", truncated: false, droppedFiles: [] };
  }

  const droppedFiles: string[] = [];

  // 1. Filtern.
  const kept = files.filter((f) => {
    if (isNoise(f.path) || isBinaryBlock(f.body)) {
      droppedFiles.push(f.path);
      return false;
    }
    return true;
  });

  // 2. Priorisieren. Array.prototype.sort ist stabil — gleiche Prioritaet
  //    behaelt die Reihenfolge aus dem Roh-Diff.
  const sorted = [...kept].sort((a, b) => priorityOf(a.path) - priorityOf(b.path));

  // 3. Kappen — strikte Praefix-Semantik: "die wichtigsten Dateien, die am
  //    Stueck ins Budget passen". Die erste nicht passende Datei beendet die
  //    Aufnahme; alle weiteren werden verworfen, auch wenn sie kleiner waeren.
  //
  //    Bewusst KEIN Best-Fit-Auffuellen des Restplatzes: sonst rutscht eine
  //    kleine `plan.md` (Prioritaet 5) in den Diff, waehrend ein groesserer
  //    `src/lib/services/*.ts` (Prioritaet 3) draussen bleibt — der Reviewer
  //    urteilte dann ueber Doku statt ueber Code. Ungenutztes Restbudget ist
  //    der guenstigere Preis.
  const parts: string[] = [];
  let used = 0;
  let budgetTruncated = false;

  for (const [index, file] of sorted.entries()) {
    const remaining = budget - used;

    if (file.body.length <= remaining) {
      parts.push(file.body);
      used += file.body.length;
      continue;
    }

    // Die wichtigste Datei ist allein groesser als das Budget: lieber ein
    // angeschnittener Anfang als gar kein Signal. Nur zulaessig, solange noch
    // nichts geschrieben wurde — sonst klebte ein Teil-Block unlesbar an der
    // Datei davor.
    const partiallyIncluded = parts.length === 0 && remaining > 0;
    if (partiallyIncluded) {
      parts.push(file.body.slice(0, remaining));
    }

    // Angeschnittene Datei zaehlt als enthalten, alle folgenden als verworfen.
    const firstDropped = partiallyIncluded ? index + 1 : index;
    droppedFiles.push(...sorted.slice(firstDropped).map((f) => f.path));
    budgetTruncated = true;
    break;
  }

  return {
    diff: parts.join(""),
    truncated: budgetTruncated || droppedFiles.length > 0,
    droppedFiles,
  };
}
