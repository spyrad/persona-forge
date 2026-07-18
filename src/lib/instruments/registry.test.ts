import { describe, expect, it, vi } from "vitest";
import { HEXACO } from "@/lib/instruments/hexaco";
import { getInstrument } from "@/lib/instruments/registry";
import { OEJTS } from "@/lib/instruments/oejts";

describe("getInstrument — Auflösung", () => {
  it("löst registrierte Ids zum jeweiligen Instrument auf", () => {
    expect(getInstrument(OEJTS.id)).toBe(OEJTS);
    expect(getInstrument(HEXACO.id)).toBe(HEXACO);
  });
});

describe("getInstrument — Fehlerpfad (kein stiller Fallback)", () => {
  it("wirft bei unbekannter Id einen Fehler mit der Id, statt still ein anderes Instrument zu liefern", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => getInstrument("does-not-exist")).toThrow("unknown instrument_id: does-not-exist");
    } finally {
      spy.mockRestore();
    }
  });

  it("loggt den unbekannten Zugriff serverseitig (→ Sentry via captureConsole)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => getInstrument("bogus-id")).toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
      const message = String(spy.mock.calls[0][0]);
      expect(message).toContain("[instruments]");
      expect(message).toContain("bogus-id");
      expect(message).toContain("no silent fallback");
    } finally {
      spy.mockRestore();
    }
  });

  it("löst Steadfastness NICHT auf — der zweite Test-Typ läuft über den kind-Dispatch, nie über die Registry", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => getInstrument("steadfastness")).toThrow("unknown instrument_id: steadfastness");
    } finally {
      spy.mockRestore();
    }
  });
});
