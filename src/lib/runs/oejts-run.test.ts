import { describe, expect, it } from "vitest";
import { OEJTS } from "@/lib/instruments/oejts";
import { buildItemMessages, parseOejtsResponse, permuteItems } from "@/lib/runs/oejts-run";

const ITEMS = OEJTS.items;
const IDS = ITEMS.map((i) => i.id);

describe("permuteItems", () => {
  it("ist deterministisch: gleicher Seed → gleiche Reihenfolge", () => {
    const a = permuteItems(ITEMS, 12345);
    const b = permuteItems(ITEMS, 12345);
    expect(a.order).toEqual(b.order);
    expect(a.ordered.map((i) => i.id)).toEqual(b.ordered.map((i) => i.id));
  });

  it("verschiedene Seeds → (typischerweise) verschiedene Reihenfolge", () => {
    const a = permuteItems(ITEMS, 1);
    const b = permuteItems(ITEMS, 2);
    expect(a.order).not.toEqual(b.order);
  });

  it("enthaelt jede Item-Id genau einmal (Permutation, keine Verluste)", () => {
    const { ordered, order } = permuteItems(ITEMS, 999);
    expect(ordered).toHaveLength(ITEMS.length);
    expect([...order].sort((x, y) => x - y)).toEqual(ITEMS.map((_, i) => i));
    expect(new Set(ordered.map((i) => i.id)).size).toBe(ITEMS.length);
  });
});

describe("buildItemMessages", () => {
  it("setzt den Persona-Prompt als System-Message", () => {
    const msgs = buildItemMessages("Du bist skeptisch.", ITEMS);
    expect(msgs[0]).toEqual({ role: "system", content: "Du bist skeptisch." });
    expect(msgs[1].role).toBe("user");
  });

  it("enthaelt alle Item-Ids und die JSON-Aufforderung", () => {
    const msgs = buildItemMessages("x", ITEMS);
    for (const id of IDS) expect(msgs[1].content).toContain(`${id}:`);
    expect(msgs[1].content).toContain('"answers"');
  });

  it("Baseline: leerer System-Prompt → System-Message wird weggelassen", () => {
    for (const empty of ["", "  \n "]) {
      const msgs = buildItemMessages(empty, ITEMS);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe("user");
    }
  });

  it("rendert bipolare Items mit beiden Polen (OEJTS-Wortlaut unveraendert)", () => {
    const msgs = buildItemMessages("x", ITEMS);
    expect(msgs[1].content).toContain('Q1: 1 = "makes lists"  …  5 = "relies on memory"');
    expect(msgs[1].content).toContain("two opposing");
  });

  it("rendert Likert-Aussagen mit IPIP-Instruktion (Item-Union)", () => {
    const likert = [
      { id: "H1", axis: "H", sign: 1 as const, text: "Don't pretend to be more than I am" },
      { id: "X2", axis: "X", sign: -1 as const, text: "Don't talk a lot" },
    ];
    const msgs = buildItemMessages("x", likert);
    expect(msgs[1].content).toContain('H1: "Don\'t pretend to be more than I am"');
    expect(msgs[1].content).toContain("very inaccurate");
    expect(msgs[1].content).not.toContain("two opposing");
  });
});

describe("parseOejtsResponse", () => {
  it("parst sauberes JSON {answers:[…]}", () => {
    const raw = JSON.stringify({ answers: IDS.map((id, i) => ({ id, value: (i % 5) + 1 })) });
    const { values, okCount } = parseOejtsResponse(raw, IDS);
    expect(okCount).toBe(IDS.length);
    expect(values[0]).toEqual({ id: "Q1", value: 1, status: "ok" });
  });

  it("parst JSON in einem Markdown-Codefence mit Zusatztext", () => {
    const inner = JSON.stringify({ answers: [{ id: "Q1", value: 4 }] });
    const raw = `Hier mein Ergebnis:\n\`\`\`json\n${inner}\n\`\`\`\nDanke!`;
    const { values } = parseOejtsResponse(raw, ["Q1"]);
    expect(values[0]).toEqual({ id: "Q1", value: 4, status: "ok" });
  });

  it("parst die flache Objektform { Q1: 3, … }", () => {
    const { values } = parseOejtsResponse('{"Q1": 3, "Q2": 5}', ["Q1", "Q2"]);
    expect(values).toEqual([
      { id: "Q1", value: 3, status: "ok" },
      { id: "Q2", value: 5, status: "ok" },
    ]);
  });

  it("markiert fehlende Items als unparsed", () => {
    const { values, okCount } = parseOejtsResponse('{"answers":[{"id":"Q1","value":2}]}', ["Q1", "Q2"]);
    expect(okCount).toBe(1);
    expect(values[1]).toEqual({ id: "Q2", value: null, status: "unparsed" });
  });

  it("weist Out-of-Range-Werte ab", () => {
    const { values } = parseOejtsResponse('{"answers":[{"id":"Q1","value":9},{"id":"Q2","value":0}]}', ["Q1", "Q2"]);
    expect(values[0].status).toBe("unparsed");
    expect(values[1].status).toBe("unparsed");
  });

  it("nutzt den Freitext-Fallback, wenn kein JSON vorliegt", () => {
    const raw = "Q1: 2\nQ2 = 4\nQ3) 5";
    const { values, okCount } = parseOejtsResponse(raw, ["Q1", "Q2", "Q3"]);
    expect(okCount).toBe(3);
    expect(values.map((v) => v.value)).toEqual([2, 4, 5]);
  });

  it("liefert okCount 0 bei vollstaendig ungparsebarer Antwort", () => {
    const { okCount, values } = parseOejtsResponse("Ich moechte diese Fragen nicht beantworten.", ["Q1", "Q2"]);
    expect(okCount).toBe(0);
    expect(values.every((v) => v.status === "unparsed")).toBe(true);
  });

  it("ist deterministisch", () => {
    const raw = '{"answers":[{"id":"Q1","value":3}]}';
    expect(parseOejtsResponse(raw, ["Q1"])).toEqual(parseOejtsResponse(raw, ["Q1"]));
  });
});
