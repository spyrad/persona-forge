import { describe, expect, it } from "vitest";
import { buildPrompt, REVIEW_INSTRUCTIONS } from "@/lib/ai-review/prompt";
import { LLM_RULE_IDS, RULES, STATIC_RULE_IDS } from "@/lib/ai-review/schema";

describe("REVIEW_INSTRUCTIONS", () => {
  it("rendert jede llm-Regel aus dem Katalog", () => {
    // Der z.ai-Endpunkt kann kein json_schema — die Regel-IDs erreichen das Modell
    // NUR ueber den Prompt. Waechst RULES, muss dieser Test brechen, nicht der
    // erste LLM-Lauf in CI.
    for (const id of LLM_RULE_IDS) {
      expect(REVIEW_INSTRUCTIONS).toContain(`"${id}"`);
      expect(REVIEW_INSTRUCTIONS).toContain(RULES[id].description);
    }
  });

  it("zeigt dem Modell KEINE statisch geprueften Regeln", () => {
    // Sie deterministisch zu pruefen und trotzdem danach zu fragen, erzeugt nur
    // Duplikate und Falsch-Positive.
    for (const id of STATIC_RULE_IDS) {
      expect(REVIEW_INSTRUCTIONS).not.toContain(`"${id}"`);
    }
  });

  it("verbietet das Melden von Code, der gar nicht im Diff steht", () => {
    // Gemessen: die Noten-Variante erfand fuer einen Diff ohne Migration einen
    // RLS-Mangel. Die Regel dagegen muss woertlich im Prompt stehen.
    expect(REVIEW_INSTRUCTIONS).toContain("Bewerte nie die Abwesenheit von Code");
    expect(REVIEW_INSTRUCTIONS).toContain("leeres findings-Array");
  });

  it("weist die mechanisch gefangenen Themen ab", () => {
    expect(REVIEW_INSTRUCTIONS).toContain("NICHT melden");
    expect(REVIEW_INSTRUCTIONS).toContain("Prettier");
  });

  it("nimmt generierte shadcn/ui-Komponenten aus", () => {
    expect(REVIEW_INSTRUCTIONS).toContain("src/components/ui/");
  });
});

describe("buildPrompt", () => {
  const base = { title: "feat: x", body: "macht x", diff: "diff --git a/x b/x", truncated: false, droppedFiles: [] };

  it("uebernimmt Titel, Body und Diff", () => {
    const p = buildPrompt(base);
    expect(p).toContain("feat: x");
    expect(p).toContain("macht x");
    expect(p).toContain("diff --git a/x b/x");
    expect(p).not.toContain("gekuerzt");
  });

  it("faengt leeren Titel und Body ab", () => {
    const p = buildPrompt({ ...base, title: "  ", body: "" });
    expect(p).toContain("(kein Titel)");
    expect(p).toContain("(keine Beschreibung)");
  });

  it("warnt bei gekuerztem Diff und nennt die fehlenden Dateien", () => {
    // Ohne diesen Hinweis meldet das Modell "missing-test-for-risky-change" fuer
    // eine Testdatei, die nur dem Zeichen-Budget zum Opfer fiel.
    const p = buildPrompt({ ...base, truncated: true, droppedFiles: ["src/lib/a.test.ts"] });
    expect(p).toContain("gekuerzt");
    expect(p).toContain("src/lib/a.test.ts");
    expect(p).toContain("Test-Abdeckung");
  });
});
