# Workflow-Status: persona-forge

**Letztes Update:** 2026-07-01 (Session 4)
**Letzter Session-Log:** `dtb-project/project-changelog/2026-07/2026-07-01.md`

---

## Aktueller Stand

| Kennzahl              | Wert                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Laufende Arbeit**   | Zwei Features **live**: Lauf-/Wiederholungs-Timing + z.ai `thinking:disabled`. Beide via superpowers-Flow (Spec/Plan/SDD), CI grün, Prod 200. `origin/main = c5631f0`, Baum sauber. Warten auf Live-Abnahme. |
| **Naechster Schritt** | **Live-Abnahme** eines z.ai-Laufs (glm-5.2, Coding-Endpunkt): schnell (~2–3 s/Rep) + Timing sichtbar (Live/Ergebnis/Liste). Dann **Termin-Entscheidung 2026-07-02**.                                         |
| **Blocker**           | Keine.                                                                                                                                                                                                       |

---

## Offene Aufgaben

- [ ] **Live-Abnahme** Timing + thinking-Fix mit einem z.ai-Lauf.
- [ ] **Termin-Entscheidung 2026-07-02:** Builder allein (5. Juli, Auszeichnung) vs. Builder+Architect (10. Aug); kein Nachreichen.
- [ ] **Geparkt — Fehler-Sichtbarkeit:** pro-Rep-`error` im UI anzeigen + Upstream-Fehlertext durchreichen (der „ich sehe die Fehler nicht"-Mangel) — eigener Vorgang.
- [ ] **Optional Mikro-Härtung:** `isZaiEndpoint` auf `=== "z.ai" || endsWith(".z.ai")` (kein realer Angriffsweg).
- [ ] **Architektur-Report einreichen** — `context/architect-report.md` ins Zert-Formular (letzte Kurswoche).
- [ ] **OEJTS-Items** als gemeinfreie Quelle dokumentieren; **Repo-Description + Topics** auf GitHub.

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                     | Ergebnis                                                                                                                   | Details                                             |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 2026-07-01 | **Feature: z.ai `thinking:disabled`**           | Host-Gate `isZaiEndpoint` → additives `thinking`-Feld nur für z.ai; GLM-Läufe ~2,8 s statt 9–16 s; 77/77, CI/Prod grün     | `a8753de`→`c5631f0`, `2026-07-01.md` (S4)           |
| 2026-07-01 | **Feature: Lauf-/Wiederholungs-Timing**         | Migration `duration_ms`+`finished_at`; `summarizeTiming`; Modell-Zeit+Wall-Clock+Datum in Ergebnis/Live/Liste; 7 Tasks SDD | `31e9383`→`dfe0170`, `2026-07-01.md` (S4)           |
| 2026-07-01 | **z.ai-Debug**                                  | 429 = Coding-Plan-Key auf falschem Endpunkt; Hängerei = GLM-Reasoning; beides am API belegt                                | `2026-07-01.md` (S4), `persona-forge-zai-provider`  |
| 2026-07-01 | **Modellname-Vorschläge (datalist)**            | `probeModels` gibt `models[]`, UI `<datalist>` + Freitext; abgenommen (z.ai-Läufe laufen)                                  | `e1aeb37`, `2026-07-01.md` (S3)                     |
| 2026-07-01 | **Krypto-Key-Mismatch + `ENCRYPTION_KEY` live** | Prod-Key = `.dev.vars`-Key der geteilten DB; Deploy-Job synct Secret; Läufe laufen                                         | `70784f7`/`93fae0c`, `2026-07-01.md` (S1/S2)        |
| 2026-07-01 | **Modul-4 (10xArchitect) KOMPLETT**             | 4/4 Artefakte + Architektur-Report (PL, einreichbereit)                                                                    | `context/architect-report.md`, `2026-07-01.md` (S1) |
| 2026-06-30 | **Modul-4 L2–L4 + `ui-redesign`/E2E**           | Projekt-Map, Run-Flow-Analyse, C-B-Refaktor live; Token-System + Dark Mode                                                 | `2026-06-30.md`, `2026-06-29.md`                    |
| 2026-06-25 | **Test-Rollout KOMPLETT**                       | `ci`+`integration`-CI-Gate; E2E-Lernschicht                                                                                | `1b2c0ac`→`b6c7589`, `2026-06-25.md`                |
| 2026-06-18 | **S-04/S-05 (Lauf + Verteilung) live**          | OEJTS-Lauf end-to-end + Verteilung/Typ-Stabilität je Achse                                                                 | `d06afbe`, `2eb4da5`                                |

---

## Gotchas (Referenz)

- **z.ai:** Coding-Plan-Key braucht Endpunkt `api.z.ai/api/coding/paas/v4` (Standard+bezahltes Modell → 429); GLM reasont per Default → jetzt via `thinking:disabled` (Host-Gate) abgeschaltet. Siehe Memory `persona-forge-zai-provider`.
- **`ENCRYPTION_KEY` MUSS = `.dev.vars`/`.env`-Key** sein (Prod + Dev teilen dieselbe gehostete Supabase-DB `lccaundrniuievkmusko`), sonst sind Modellkonfig-Keys unentschlüsselbar → Läufe hängen 0/N.
- **Migrationen** gehen NICHT über den Deploy-Job — separat auf die gehostete DB (`supabase db push`/Dashboard), **vor** dem Worker-Deploy (additive nullable Spalten sind kompatibel).
- **Push auf `main` = Prod-Deploy**; CI-Fail blockt Deploy lautlos → nach Push Runs per REST prüfen (`gh` fehlt; `curl.exe --ssl-no-revoke` gegen `api.github.com/.../actions/runs`, direkt in node-stdin pipen).
- **Timing-Artefakte:** `src/lib/runs/run-timing.ts`, Messung in `services/runs.ts#processNextRepetition`, `RunResultView.timing`. Wall-Clock enthält bewusst Leerlauf; Modell-Zeit = Σ Rep-Dauern.

---

## Pausierte Themen

Keine.

---

## Session-Resume

Fuer neue Session: `/dtb:workflow-resume`
