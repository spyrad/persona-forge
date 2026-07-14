import { describe, expect, it } from "vitest";
import { modelProfileHref } from "./profile-link";

describe("modelProfileHref", () => {
  it("baut den Profil-Link mit `?m=`", () => {
    expect(modelProfileHref("claude-opus-4-8")).toBe("/models/profile?m=claude-opus-4-8");
  });

  it("encodiert Slash und Doppelpunkt in Modellnamen", () => {
    expect(modelProfileHref("openai/gpt-5.5")).toBe("/models/profile?m=openai%2Fgpt-5.5");
    expect(modelProfileHref("ollama:llama3")).toBe("/models/profile?m=ollama%3Allama3");
  });

  it("encodiert Query-Trenner, sodass der Name ein einziger Param bleibt", () => {
    expect(modelProfileHref("a&m=b")).toBe("/models/profile?m=a%26m%3Db");
  });
});
