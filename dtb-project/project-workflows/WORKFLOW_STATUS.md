# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-02 (Session 2)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-02.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Laufende Arbeit**   | Feature **Fehler-Sichtbarkeit** live **und Prod-abgenommen**: Live-Smoke am 2026-07-02 14:21 grün — falsche z.ai-Config → Empty-State + aggregierte Liste „2× endpoint returned status 429: Insufficient balance…". `origin/main = 9f0d3e0`, CI grün, Prod live. Nichts offen in-flight. |
| **Naechster Schritt** | **Termin-Entscheidung Sa 2026-07-04** (Builder allein vs. Builder+Architect). Kein aktives Feature.                                                                                                                                                                                      |
| **Blocker**           | Keine.                                                                                                                                                                                                                                                                                   |

---

## Offene Aufgaben

- [x] **Live-Smoke Fehler-Sichtbarkeit auf Prod** — ABGENOMMEN (2026-07-02 14:21): falsche z.ai-Config → Empty-State „Keine verwertbaren Antworten" (2/2) + aggregierte Liste „2× endpoint returned status 429: Insufficient balance or no resource package. Please recharge." Leak-sicher (nur `error.message`).
- [ ] **Termin-Entscheidung Sa 2026-07-04:** Builder allein (5. Juli, Auszeichnung) vs. Builder+Architect (10. Aug); kein Nachreichen. Beide einreichbereit.
- [ ] **Optionale Minors (geparkt, kein Blocker):** DRY-Duplikat der 2 Fehler-Stellen in `openai-compatible.ts`; `localeCompare`-Locale in `run-failures.ts`; direkter Test für den Retryable-429/5xx-Upstream-Pfad.
- [ ] **Optional Mikro-Härtung:** `isZaiEndpoint` auf `=== "z.ai" || endsWith(".z.ai")` (kein realer Angriffsweg).
- [ ] **Architektur-Report einreichen** — `context/architect-report.md` ins Zert-Formular (letzte Kurswoche).
- [ ] **OEJTS-Items** als gemeinfreie Quelle dokumentieren; **Repo-Description + Topics** auf GitHub.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                     | Ergebnis                                                                                                                                                                     | Details                                             |
| ---------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 2026-07-02 | **Feature: Fehler-Sichtbarkeit**                | Upstream-`error.message` durchgereicht (leak-sicher, 200-Cap) + UI: live sticky (`RunRunner`) + aggregiert (`RunResult`); 7 Tasks SDD, opus-Review „Ready:Yes", CI/Prod grün | `d9d3a09`→`9f0d3e0`, `2026-07-02.md` (S2)           |
| 2026-07-02 | **Live-Abnahme: Timing + z.ai `thinking`**      | Beide S4-Features gegen Prod abgenommen: OpenAI- + z.ai-Lauf je 5/5, Fehlquote 0, Timing an Live/Ergebnis/Liste; z.ai kein Hang                                              | `2026-07-02.md` (S1)                                |
| 2026-07-01 | **Feature: z.ai `thinking:disabled`**           | Host-Gate `isZaiEndpoint` → additives `thinking`-Feld nur für z.ai; GLM-Läufe ~2,8 s statt 9–16 s; 77/77, CI/Prod grün                                                       | `a8753de`→`c5631f0`, `2026-07-01.md` (S4)           |
| 2026-07-01 | **Feature: Lauf-/Wiederholungs-Timing**         | Migration `duration_ms`+`finished_at`; `summarizeTiming`; Modell-Zeit+Wall-Clock+Datum in Ergebnis/Live/Liste; 7 Tasks SDD                                                   | `31e9383`→`dfe0170`, `2026-07-01.md` (S4)           |
| 2026-07-01 | **z.ai-Debug**                                  | 429 = Coding-Plan-Key auf falschem Endpunkt; Hängerei = GLM-Reasoning; beides am API belegt                                                                                  | `2026-07-01.md` (S4), `persona-forge-zai-provider`  |
| 2026-07-01 | **Krypto-Key-Mismatch + `ENCRYPTION_KEY` live** | Prod-Key = `.dev.vars`-Key der geteilten DB; Deploy-Job synct Secret; Läufe laufen                                                                                           | `70784f7`/`93fae0c`, `2026-07-01.md` (S1/S2)        |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**             | 4/4 Artefakte + Architektur-Report (PL, einreichbereit)                                                                                                                      | `context/architect-report.md`, `2026-07-01.md` (S1) |
| 2026-06-30 | **Modul-4 L2–L4 + `ui-redesign`/E2E**           | Projekt-Map, Run-Flow-Analyse, C-B-Refaktor live; Token-System + Dark Mode                                                                                                   | `2026-06-30.md`, `2026-06-29.md`                    |
| 2026-06-25 | **Test-Rollout KOMPLETT**                       | `ci`+`integration`-CI-Gate; E2E-Lernschicht                                                                                                                                  | `1b2c0ac`→`b6c7589`, `2026-06-25.md`                |

---

## Gotchas (Referenz)

- **Fehler-Sichtbarkeit:** pro-Rep-`error` persistiert (`run_repetitions.error`); `getRunResult`→`RunResultView.failures` (aggregiert via `summarizeFailures`), `RunProgress.lastRepError` (live). Upstream-Text via `extractUpstreamError` (`openai-compatible.ts`, nur `error.message`, 200-Cap, kein Key/Header). UI escaped (React) → kein XSS.
- **z.ai:** Coding-Plan-Key braucht Endpunkt `api.z.ai/api/coding/paas/v4` (Standard+bezahltes Modell → 429); GLM reasont per Default → via `thinking:disabled` (Host-Gate) abgeschaltet. Memory `persona-forge-zai-provider`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** sein (Prod + Dev teilen gehostete Supabase-DB `lccaundrniuievkmusko`), sonst Modellkonfig-Keys unentschlüsselbar → Läufe hängen 0/N.
- **Migrationen** gehen NICHT über den Deploy-Job — separat auf die gehostete DB, **vor** dem Worker-Deploy (additive nullable Spalten kompatibel).
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push Runs per REST prüfen (`gh` fehlt; `curl.exe --ssl-no-revoke` gegen `api.github.com/.../actions/runs`, in node-stdin pipen).

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
