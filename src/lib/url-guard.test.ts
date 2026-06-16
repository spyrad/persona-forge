import { describe, expect, it } from "vitest";
import { isPublicHttpsUrl } from "@/lib/url-guard";

describe("isPublicHttpsUrl", () => {
  it("erlaubt oeffentliche https-URLs", () => {
    expect(isPublicHttpsUrl("https://api.openai.com/v1")).toBe(true);
    expect(isPublicHttpsUrl("https://openrouter.ai/api/v1")).toBe(true);
    expect(isPublicHttpsUrl("https://example.com")).toBe(true);
  });

  it("blockt http (kein TLS)", () => {
    expect(isPublicHttpsUrl("http://api.openai.com/v1")).toBe(false);
  });

  it("blockt localhost-Varianten", () => {
    expect(isPublicHttpsUrl("https://localhost/v1")).toBe(false);
    expect(isPublicHttpsUrl("https://foo.localhost")).toBe(false);
    expect(isPublicHttpsUrl("https://127.0.0.1")).toBe(false);
    expect(isPublicHttpsUrl("https://[::1]")).toBe(false);
  });

  it("blockt private + link-local + CGNAT IPv4-Ranges", () => {
    expect(isPublicHttpsUrl("https://10.0.0.1")).toBe(false);
    expect(isPublicHttpsUrl("https://172.16.0.5")).toBe(false);
    expect(isPublicHttpsUrl("https://172.31.255.255")).toBe(false);
    expect(isPublicHttpsUrl("https://192.168.1.1")).toBe(false);
    expect(isPublicHttpsUrl("https://169.254.169.254")).toBe(false); // Cloud-Metadata
    expect(isPublicHttpsUrl("https://100.64.0.1")).toBe(false);
  });

  it("blockt IPv6-Literale pauschal", () => {
    expect(isPublicHttpsUrl("https://[fe80::1]")).toBe(false);
    expect(isPublicHttpsUrl("https://[2606:4700::1111]")).toBe(false);
  });

  it("erlaubt oeffentliches IPv4-Literal", () => {
    expect(isPublicHttpsUrl("https://1.1.1.1")).toBe(true);
  });

  it("weist Muell/leere Eingaben ab", () => {
    expect(isPublicHttpsUrl("")).toBe(false);
    expect(isPublicHttpsUrl("not a url")).toBe(false);
    expect(isPublicHttpsUrl("ftp://example.com")).toBe(false);
  });
});
