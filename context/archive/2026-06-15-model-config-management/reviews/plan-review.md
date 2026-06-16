<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Model Config Management (S-02)

- **Plan**: context/changes/model-config-management/plan.md
- **Mode**: Deep
- **Date**: 2026-06-15
- **Verdict**: REVISE → SOUND (nach Fixes)
- **Findings**: 1 critical · 1 warning · 1 observation (alle FIXED)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL (F1, F3) |
| Plan Completeness | WARNING (F2) |

## Grounding

8/8 paths ✓, 5/5 to-create absent ✓, @/* alias ✓, brief↔plan ✓, Progress↔Phase consistent (1.1–1.6, 2.1–2.7, 3.1–3.7, 4.1–4.7) ✓

## Findings

### F1 — crypto.ts an astro:env gekoppelt macht die geplanten Vitest-Tests unrunbar

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 #5 (crypto.ts) + #6 (crypto.test.ts), Critical Implementation Details
- **Detail**: Plan ließ `crypto.ts` `ENCRYPTION_KEY` aus `astro:env/server` importieren (wie supabase.ts:3) UND wollte es mit plain Vitest testen via `vi.stubEnv`/Mock. Verifiziert: `astro:env/server` ist ein Vite-Virtual-Module (astro/dist/env/constants.js), in plain Vitest nicht auflösbar; `vi.stubEnv` wirkt nur auf process.env, nie auf ein virtuelles Modul. Phase 1 wäre nicht ausführbar gewesen.
- **Fix ⭐ Recommended**: crypto.ts als reines Logik-Modul — Key als Parameter (`encryptApiKey(plaintext, keyBase64)`); astro:env-Zugriff + Fail-closed in dünner server-only `getEncryptionKey()`-Schicht (Service/Route). Test übergibt Test-Key direkt, kein Astro/Mock nötig.
  - Strength: Konsistent mit Service-nimmt-Client-Konvention; hält Default-Node-Vitest gültig.
  - Tradeoff: crypto.ts kennt den Key nicht selbst — dünne getEncryptionKey()-Schicht liest Env.
  - Confidence: HIGH — astro:env als Virtual-Module + vi.stubEnv-Grenze belegt (Sub-Agent-Verifikation).
  - Blind spot: Keiner wesentlich.
- **Decision**: FIXED (Fix angewendet — Critical-Details, Phase 1 #5/#6, Service-Vertrag Phase 2 #3)

### F2 — owner_id "default oder explizit" offen + irreführender profiles-Verweis

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 #3 Service-Contract (vormals plan.md:267)
- **Detail**: Plan ließ owner_id-Setzen offen ("default oder explizit, passend zum profiles-Muster"). Verifiziert: profiles hat keine owner_id (setzt `id` explizit, rls_foundation.sql:16,28), `_rls_probe` nutzt `owner_id ... default auth.uid()` (Zeile 39). Referenz widersprüchlich.
- **Fix**: `_rls_probe`-Muster — `owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade`; Insert ohne owner_id; profiles-Verweis entfernt.
- **Decision**: FIXED (Migration-Contract Phase 2 #1 + Service-Vertrag Phase 2 #3 angepasst)

### F3 — test-connection: Worker-Fetch gegen user-gelieferte base_url

- **Severity**: 💭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 #2 (test-connection.ts)
- **Detail**: Server macht GET an beliebige user-gelieferte base_url mit entschlüsseltem Key. Geringes Risiko (Solo-Tool, Worker-Egress öffentlich), aber Plan erwähnte die Grenze nicht.
- **Fix**: base_url per zod-Refine auf https + öffentliche Hosts beschränken (kein localhost/private IPs); gilt auch für create/update-Schemas. Timeout war bereits geplant.
- **Decision**: FIXED (Phase 3 #2 Contract angepasst)
