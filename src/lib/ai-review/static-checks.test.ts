import { describe, expect, it } from "vitest";
import { RULES, STATIC_RULE_IDS, type RuleId } from "@/lib/ai-review/schema";
import { staticFindings } from "@/lib/ai-review/static-checks";

/** Baut einen Diff-Block. `mode: "new"` setzt die `new file mode`-Metazeile. */
function block(path: string, added: string[], mode: "new" | "edit" = "new"): string {
  const header = mode === "new" ? `new file mode 100644\n` : "";
  const body = added.map((l) => `+${l}`).join("\n");
  return `diff --git a/${path} b/${path}\n${header}--- a/${path}\n+++ b/${path}\n@@ -0,0 +1 @@\n${body}\n`;
}

const rulesOf = (diff: string): RuleId[] => staticFindings(diff).map((f) => f.rule);

const MIGRATION = "supabase/migrations/20260709120000_notes.sql";
const ROUTE = "src/pages/api/notes/index.ts";

describe("Katalog-Konsistenz", () => {
  it("prueft genau die als static markierten Regeln", () => {
    expect(STATIC_RULE_IDS).toEqual([
      "color-literal",
      "missing-prerender",
      "lowercase-handler",
      "missing-rls",
      "blanket-policy",
      "uncached-auth-uid",
      "missing-owner-index",
    ]);
    for (const id of STATIC_RULE_IDS) expect(RULES[id].detector).toBe("static");
  });
});

describe("missing-rls", () => {
  it("erkennt eine Tabelle ohne enable row level security — auch bei vorbildlichen Policies", () => {
    // Genau der Fall, den glm-5.2 in 1 von 3 Laeufen uebersah: die Policies sind
    // korrekt und granular, aber ohne RLS-Aktivierung wirkungslos.
    const diff = block(MIGRATION, [
      "create table labels (",
      "  id uuid primary key,",
      "  owner_id uuid not null references auth.users(id)",
      ");",
      "create index labels_owner_id_idx on labels (owner_id);",
      'create policy "labels_select_own" on labels',
      "  for select to authenticated",
      "  using ((select auth.uid()) = owner_id);",
    ]);

    expect(rulesOf(diff)).toEqual(["missing-rls"]);
  });

  it("meldet nichts, wenn RLS aktiviert ist", () => {
    const diff = block(MIGRATION, [
      "create table labels (id uuid primary key, owner_id uuid not null);",
      "create index labels_owner_id_idx on labels (owner_id);",
      "alter table labels enable row level security;",
      'create policy "p" on labels for select to authenticated using ((select auth.uid()) = owner_id);',
    ]);

    expect(rulesOf(diff)).toEqual([]);
  });

  it("akzeptiert die enable-Zeile aus einer anderen Migration desselben Diffs", () => {
    const diff =
      block(MIGRATION, ["create table labels (id uuid primary key);"]) +
      block("supabase/migrations/20260709130000_rls.sql", ["alter table labels enable row level security;"]);

    expect(rulesOf(diff)).not.toContain("missing-rls");
  });

  it("ist gegen Schreibweisen robust", () => {
    const diff = block(MIGRATION, [
      'CREATE TABLE IF NOT EXISTS "labels" (id uuid primary key);',
      'ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;',
    ]);

    expect(rulesOf(diff)).not.toContain("missing-rls");
  });
});

describe("blanket-policy", () => {
  it("erkennt eine for-all-Policy", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key);",
      "alter table n enable row level security;",
      'create policy "n_all" on n for all using (true);',
    ]);

    expect(rulesOf(diff)).toContain("blanket-policy");
  });

  it("erkennt using (true) auf einer Folgezeile", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key);",
      "alter table n enable row level security;",
      'create policy "n_sel" on n',
      "  for select to authenticated",
      "  using (true);",
    ]);

    expect(rulesOf(diff)).toContain("blanket-policy");
  });

  it("meldet eine granulare Policy nicht", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key, owner_id uuid);",
      "create index n_owner_id_idx on n (owner_id);",
      "alter table n enable row level security;",
      'create policy "n_sel" on n for select to authenticated using ((select auth.uid()) = owner_id);',
    ]);

    expect(rulesOf(diff)).toEqual([]);
  });
});

describe("uncached-auth-uid", () => {
  it("erkennt nacktes auth.uid()", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key);",
      "alter table n enable row level security;",
      'create policy "p" on n for select to authenticated using (auth.uid() = owner_id);',
    ]);

    expect(rulesOf(diff)).toContain("uncached-auth-uid");
  });

  it("akzeptiert (select auth.uid())", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key);",
      "alter table n enable row level security;",
      'create policy "p" on n for select to authenticated using ((select auth.uid()) = owner_id);',
    ]);

    expect(rulesOf(diff)).not.toContain("uncached-auth-uid");
  });
});

describe("missing-owner-index", () => {
  it("erkennt owner_id ohne Index", () => {
    const diff = block(MIGRATION, [
      "create table n (",
      "  id uuid primary key,",
      "  owner_id uuid not null",
      ");",
      "alter table n enable row level security;",
    ]);

    expect(rulesOf(diff)).toContain("missing-owner-index");
  });

  it("meldet nichts, wenn der Index existiert", () => {
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key, owner_id uuid not null);",
      "create index n_owner_id_idx on n (owner_id);",
      "alter table n enable row level security;",
    ]);

    expect(rulesOf(diff)).not.toContain("missing-owner-index");
  });
});

describe("API-Routen", () => {
  it("erkennt lowercase-Handler", () => {
    const diff = block(ROUTE, ["export const prerender = false;", "export const post: APIRoute = async () => {};"]);

    expect(rulesOf(diff)).toEqual(["lowercase-handler"]);
  });

  it("erkennt eine neue Route ohne prerender", () => {
    const diff = block(ROUTE, ["export const POST: APIRoute = async () => {};"]);

    expect(rulesOf(diff)).toEqual(["missing-prerender"]);
  });

  it("meldet prerender NICHT bei einer geaenderten Route", () => {
    // Bei einer Aenderung steht `prerender = false` womoeglich ausserhalb des Hunks.
    const diff = block(ROUTE, ["  const x = 1;"], "edit");

    expect(rulesOf(diff)).toEqual([]);
  });

  it("meldet eine korrekte neue Route nicht", () => {
    const diff = block(ROUTE, ["export const prerender = false;", "export const GET: APIRoute = async () => {};"]);

    expect(rulesOf(diff)).toEqual([]);
  });
});

describe("color-literal", () => {
  it("erkennt Farb-Literale in tsx", () => {
    const diff = block("src/components/Card.tsx", ['  <div className="bg-white/10 text-blue-400">']);

    expect(rulesOf(diff)).toEqual(["color-literal"]);
  });

  it("akzeptiert semantische Tokens", () => {
    const diff = block("src/components/Card.tsx", ['  <div className="bg-muted text-muted-foreground border-border">']);

    expect(rulesOf(diff)).toEqual([]);
  });

  it("nimmt generierte shadcn/ui-Komponenten aus", () => {
    const diff = block("src/components/ui/button.tsx", ['  "bg-destructive text-white"']);

    expect(rulesOf(diff)).toEqual([]);
  });

  it("erkennt Gradient-Utilities", () => {
    const diff = block("src/pages/index.astro", ['<h1 class="bg-gradient-to-r from-blue-500">']);

    expect(rulesOf(diff)).toContain("color-literal");
  });

  it("ignoriert Nicht-UI-Dateien", () => {
    const diff = block("src/lib/x.ts", ['const s = "text-white";']);

    expect(rulesOf(diff)).toEqual([]);
  });
});

describe("staticFindings", () => {
  it("gibt bei leerem Diff nichts zurueck", () => {
    expect(staticFindings("")).toEqual([]);
  });

  it("liefert zu jedem Finding Datei und Beleg", () => {
    const diff = block(MIGRATION, ["create table n (id uuid primary key, owner_id uuid);"]);

    for (const f of staticFindings(diff)) {
      expect(f.file).toBe(MIGRATION);
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });

  it("entfernt Doppelmeldungen derselben Regel und Fundstelle", () => {
    const line = 'create policy "p" on n for all using (true);';
    const diff = block(MIGRATION, [
      "create table n (id uuid primary key);",
      "alter table n enable row level security;",
      line,
    ]);

    // `for all` und `using (true)` treffen beide — darf trotzdem nur einmal zaehlen.
    expect(rulesOf(diff).filter((r) => r === "blanket-policy")).toHaveLength(1);
  });
});
