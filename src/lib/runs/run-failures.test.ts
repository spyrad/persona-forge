import { describe, expect, it } from "vitest";
import { summarizeFailures } from "./run-failures";

describe("summarizeFailures", () => {
  it("gruppiert gleiche Fehlertexte und zählt sie", () => {
    const out = summarizeFailures([
      { status: "failed", error: "endpoint returned status 429: insufficient balance" },
      { status: "failed", error: "endpoint returned status 429: insufficient balance" },
      { status: "failed", error: "no parseable item values in response" },
    ]);
    expect(out).toEqual([
      { message: "endpoint returned status 429: insufficient balance", count: 2 },
      { message: "no parseable item values in response", count: 1 },
    ]);
  });

  it("sortiert nach count absteigend, bei Gleichstand alphabetisch", () => {
    const out = summarizeFailures([
      { status: "failed", error: "b-fehler" },
      { status: "failed", error: "a-fehler" },
    ]);
    expect(out.map((f) => f.message)).toEqual(["a-fehler", "b-fehler"]);
  });

  it("ignoriert erfolgreiche Wiederholungen", () => {
    const out = summarizeFailures([
      { status: "ok", error: null },
      { status: "failed", error: "x" },
    ]);
    expect(out).toEqual([{ message: "x", count: 1 }]);
  });

  it("nutzt Fallback-Text bei fehlendem/leerem Fehler", () => {
    const out = summarizeFailures([
      { status: "failed", error: null },
      { status: "failed", error: "   " },
    ]);
    expect(out).toEqual([{ message: "Unbekannter Fehler", count: 2 }]);
  });

  it("liefert leeres Array ohne Fehler", () => {
    expect(summarizeFailures([{ status: "ok", error: null }])).toEqual([]);
  });
});
