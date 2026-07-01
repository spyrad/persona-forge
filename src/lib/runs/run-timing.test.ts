import { describe, expect, it } from "vitest";
import { formatDateTime, formatDuration, summarizeTiming } from "./run-timing";

describe("summarizeTiming", () => {
  it("summiert Modell-Zeit und rechnet ⌀/min/max über gültige Dauern", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", "2026-07-01T20:03:05.000Z", [18000, 61000, 33000]);
    expect(t.modelMs).toBe(112000);
    expect(t.repCount).toBe(3);
    expect(t.avgMs).toBe(37333);
    expect(t.minMs).toBe(18000);
    expect(t.maxMs).toBe(61000);
    expect(t.wallClockMs).toBe(185000);
    expect(t.executedAt).toBe("2026-07-01T20:00:00.000Z");
    expect(t.finishedAt).toBe("2026-07-01T20:03:05.000Z");
  });

  it("ignoriert null-Dauern und behandelt fehlendes finishedAt", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", null, [null, 5000, null]);
    expect(t.modelMs).toBe(5000);
    expect(t.repCount).toBe(1);
    expect(t.avgMs).toBe(5000);
    expect(t.wallClockMs).toBeNull();
  });

  it("liefert null-Kennzahlen bei leerer/durchweg-null Liste", () => {
    const t = summarizeTiming("2026-07-01T20:00:00.000Z", "2026-07-01T20:00:01.000Z", []);
    expect(t.modelMs).toBe(0);
    expect(t.repCount).toBe(0);
    expect(t.avgMs).toBeNull();
    expect(t.minMs).toBeNull();
    expect(t.maxMs).toBeNull();
    expect(t.wallClockMs).toBe(1000);
  });
});

describe("formatDuration", () => {
  it("formatiert ms/Sekunden/Minuten deutsch", () => {
    expect(formatDuration(300)).toBe("300 ms");
    expect(formatDuration(3200)).toBe("3,2 s");
    expect(formatDuration(9900)).toBe("9,9 s");
    expect(formatDuration(33000)).toBe("33 s");
    expect(formatDuration(185000)).toBe("3 m 05 s");
  });

  it("fällt bei ungültiger Eingabe auf Gedankenstrich zurück", () => {
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(-5)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formatiert ISO als de-DE Datum+Zeit (Europe/Berlin)", () => {
    expect(formatDateTime("2026-07-01T20:15:00.000Z")).toBe("01.07.2026 22:15");
  });
});
