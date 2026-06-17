import { describe, expect, it } from "vitest";
import { compilePersonaPrompt } from "@/lib/persona-compile";
import type { PersonaStructuredFields } from "@/types";

const FULL: PersonaStructuredFields = {
  coreThinking: ["Annahmen sichtbar machen.", "Evidenz vor Lautstaerke."],
  voice: ["Fragend statt urteilend."],
  decisionFilters: ["Evidenz > Plausibilitaet."],
  risks: ["Laehmung durch Zweifel."],
  exampleDialog: "Reiz: …\nSo (Persona): …",
  usage: "Standard-Load immer. Keine Overlays.",
};

describe("compilePersonaPrompt", () => {
  it("rendert die Pflicht-Sektionen §§1–4 in stabiler Reihenfolge", () => {
    const out = compilePersonaPrompt(FULL);
    expect(out).toContain("## 1. Kerndenken");
    expect(out).toContain("## 2. Stimme");
    expect(out).toContain("## 3. Entscheidungsfilter");
    expect(out).toContain("## 4. Bekannte Risiken");
    // Reihenfolge: §1 vor §2 vor §3 vor §4
    expect(out.indexOf("## 1.")).toBeLessThan(out.indexOf("## 2."));
    expect(out.indexOf("## 2.")).toBeLessThan(out.indexOf("## 3."));
    expect(out.indexOf("## 3.")).toBeLessThan(out.indexOf("## 4."));
  });

  it("nummeriert §1 (Kerndenken) und bullettet §§2–4", () => {
    const out = compilePersonaPrompt(FULL);
    expect(out).toContain("1. Annahmen sichtbar machen.");
    expect(out).toContain("2. Evidenz vor Lautstaerke.");
    expect(out).toContain("- Fragend statt urteilend.");
    expect(out).toContain("- Evidenz > Plausibilitaet.");
    expect(out).toContain("- Laehmung durch Zweifel.");
  });

  it("nimmt optionale §5/§6 auf, wenn vorhanden", () => {
    const out = compilePersonaPrompt(FULL);
    expect(out).toContain("## 5. Stimme in Aktion");
    expect(out).toContain("## 6. Nutzung");
    expect(out).toContain("Standard-Load immer.");
  });

  it("laesst §5/§6 weg, wenn leer oder nur Whitespace", () => {
    const out = compilePersonaPrompt({
      ...FULL,
      exampleDialog: "   ",
      usage: undefined,
    });
    expect(out).not.toContain("## 5.");
    expect(out).not.toContain("## 6.");
  });

  it("ist deterministisch: gleiche Eingabe → identischer Output", () => {
    expect(compilePersonaPrompt(FULL)).toBe(compilePersonaPrompt(FULL));
  });

  it("trimmt Eintraege und haengt nicht an, was nicht da ist", () => {
    const out = compilePersonaPrompt({
      coreThinking: ["  getrimmt  "],
      voice: ["v"],
      decisionFilters: ["d"],
      risks: ["r"],
    });
    expect(out).toContain("1. getrimmt");
    expect(out).not.toContain("## 5.");
    expect(out).not.toContain("## 6.");
  });
});
