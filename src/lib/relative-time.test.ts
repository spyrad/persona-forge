import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/relative-time";

const NOW = Date.parse("2026-07-15T12:00:00Z");

describe("formatRelativeTime", () => {
  it.each([
    ["2026-07-15T11:59:30Z", "just now"],
    ["2026-07-15T11:55:00Z", "5 min ago"],
    ["2026-07-15T09:00:00Z", "3 h ago"],
    ["2026-07-03T12:00:00Z", "12 d ago"],
  ])("formatiert %s als '%s'", (iso, expected) => {
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });

  it("faellt bei kuenftigen Zeitpunkten (Uhren-Drift) auf 'just now' zurueck", () => {
    expect(formatRelativeTime("2026-07-15T12:05:00Z", NOW)).toBe("just now");
  });

  it("liefert 'unknown' fuer unparsebare Eingaben", () => {
    expect(formatRelativeTime("nicht-iso", NOW)).toBe("unknown");
  });
});
