<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Model Config Management (S-02)

- **Plan**: context/changes/model-config-management/plan.md
- **Scope**: Phasen 1–4 (vollständig)
- **Date**: 2026-06-16
- **Verdict**: NEEDS ATTENTION → alle Findings triagiert (3 gefixt, 2 akzeptiert)
- **Findings**: 0 critical · 2 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → behoben (F1, F2) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated: lint sauber · test 14/14 · astro check 0 errors · build ✓.
Manual-Gate (Phasen 2–4): vollständig per E2E belegt (siehe plan.md Progress).

## Findings

### F1 — SSRF-Guard umgehbar via numerische IPv4-Schreibweisen

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/url-guard.ts:36-49
- **Detail**: dword/octal/hex-IPv4 (z.B. https://2852039166 = 169.254.169.254 Cloud-Metadata, https://0177.0.0.1, https://0x7f000001) fielen durch zur „benannter Host → erlaubt"-Verzweigung. Der Guard validiert auch gespeicherte URLs eigenständig, muss also für sich stehen.
- **Fix A ⭐**: Nach `new URL()` rein numerische/0x-Hosts ablehnen (echte Endpoints sind Domains).
- **Decision**: FIXED via Fix A (ce32b3c) — + Unit-Test (dword/octal/hex), live belegt (4× 400).

### F2 — `apiKey` ohne Längen-Cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: src/pages/api/models/index.ts:14 · src/pages/api/models/[id].ts:17
- **Detail**: create/update-zod nutzten `z.string().min(1)` ohne `.max()`; andere Felder sind gecappt. Multi-MB-Key möglich (Self-DoS, authentifiziert).
- **Fix**: `.max(512)` in beiden Schemas.
- **Decision**: FIXED (ce32b3c).

### F3 — Config-Gate prüft ENCRYPTION_KEY nur auf Anwesenheit

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/lib/config-status.ts
- **Detail**: `Boolean(ENCRYPTION_KEY)` meldet „configured" auch bei ungültigem base64/!=32 Byte; echte Validierung passiert fail-closed erst zur Encrypt-Zeit.
- **Fix**: base64/32-Byte-Länge im Status-Check mitprüfen.
- **Decision**: SKIPPED — akzeptiert (fail-closed hält; v1 ok).

### F4 — Backend-Fehler rendern stillschweigend leere Liste

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM
- **Dimension**: Reliability
- **Location**: src/pages/models.astro:~19 · src/components/models/ModelConfigManager.tsx:~89
- **Detail**: SSR-`catch` setzte leere Liste; client `refetch` aktualisierte nur bei `res.ok` — persistenter Backend-Fehler zeigte stumm eine leere Liste.
- **Fix**: refetch-`else` → `setServerError`-Banner; `models.astro` reicht `loadError` an die Island durch (Banner statt stumm leer).
- **Decision**: FIXED (ce32b3c).

### F5 — Island ohne AbortController/Unmount-Guard

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: src/components/models/ModelConfigManager.tsx
- **Detail**: Button-Guards (pending/testing/busyId) vorhanden, aber überlappende Fetches / Unmount-mid-fetch werden nicht abgebrochen. Nur UX/Race, kein Daten-/Sicherheitsrisiko.
- **Fix**: AbortController + Unmount-Cleanup.
- **Decision**: SKIPPED — akzeptiert (Button-Guards reichen für v1).

## Notes

- Plan-Drift gesamt: alle 22 geplanten Artefakte MATCH; keine fehlenden, keine Guardrail-Verstöße, keine Key-Leaks. Krypto-Architektur exakt wie spezifiziert (key-parametrisiert, env-Zugriff in `encryption-key.ts` isoliert).
- Benigne, bewusste Abweichung: `api-auth.ts` gibt bei fehlendem Supabase-Client 503 (statt „sichere 500") — semantisch sauberer, konsistent über alle Routes.
- Während des Reviews zusätzlich gefixt (vor dem Review committet): DELETE 404 bei fremder/fehlender id (23e82c6).
