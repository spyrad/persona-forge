import { describe, it, expect } from "vitest";
import { extractModelIds } from "./model-list";

describe("extractModelIds", () => {
  it("extrahiert und sortiert IDs aus einer OpenAI-kompatiblen Antwort", () => {
    const payload = { object: "list", data: [{ id: "gpt-4o" }, { id: "gpt-3.5-turbo" }] };
    expect(extractModelIds(payload)).toEqual(["gpt-3.5-turbo", "gpt-4o"]);
  });

  it("dedupliziert identische IDs", () => {
    expect(extractModelIds({ data: [{ id: "a" }, { id: "a" }, { id: "b" }] })).toEqual(["a", "b"]);
  });

  it("ignoriert Einträge ohne String-ID", () => {
    expect(extractModelIds({ data: [{ id: "ok" }, { id: 5 }, {}, null, "x", { foo: 1 }] })).toEqual(["ok"]);
  });

  it("ignoriert leere/whitespace-IDs", () => {
    expect(extractModelIds({ data: [{ id: "  " }, { id: "" }, { id: "real" }] })).toEqual(["real"]);
  });

  it("gibt eine leere Liste bei fehlendem oder falschem data-Array", () => {
    expect(extractModelIds({})).toEqual([]);
    expect(extractModelIds({ data: "nope" })).toEqual([]);
    expect(extractModelIds(null)).toEqual([]);
    expect(extractModelIds(undefined)).toEqual([]);
    expect(extractModelIds("string")).toEqual([]);
  });
});
