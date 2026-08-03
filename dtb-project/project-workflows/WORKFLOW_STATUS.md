# Workflow-Status: persona-forge

**Letztes Update:** 2026-08-03
**Letzter Session-Log:** `dtb-project/project-changelog/2026-08/2026-08-03.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature. (`features/` ist leer; letzter Change `ci-review-agent` archiviert
2026-08-03 → `context/archive/2026-07-08-ci-review-agent/`.)

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                                          |
| **Notizen** | Champion-Block (M5L3) vollstaendig zu: `ci-review-agent` archiviert, Belege in `evidence.md` (Test-PR #2, drei Run-IDs, promptfoo 12/12). Repo clean, `main` = `f0a3187`, alles gepusht. Lokales Supabase gestoppt; Docker Desktop laeuft ggf. noch. Naechstes Feature empfohlen: Inbox #8 SD3. |

---

## Offene Aufgaben

- [ ] **Einreichung 10.08.** — Kontext: Sammel-Einreichung aller 3 Badges; Belege liegen in `context/archive/2026-07-08-ci-review-agent/evidence.md`
- [ ] **Naechstes Feature waehlen** — Kontext: #8 SD3 empfohlen (Registry-Umbau kommt aus HEXACO, Aufwand gering), Lizenz Jones & Paulhus 2014 vor der Spec verifizieren
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE
- [ ] **Housekeeping** — Docker Desktop beenden (optional)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                       | Ergebnis                                                               | Details                            |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| 2026-08-03 | **CI-Review-Agent archiviert (Champion M5L3 zu)** | PR #21 gemerged, Change archiviert (`4361839`), Lektion L4 (`f0a3187`) | `2026-08-03.md`                    |
| 2026-07-19 | Live-Run-Visualisierung end-to-end + abgenommen   | 9/9; PR #16 + Review-Fix #17 (7/7 FIXED); Prod-Abnahme per Screenshot  | `archive/live-run-visualisierung/` |
| 2026-07-18 | HEXACO-Instrument abgeschlossen + archiviert      | 17/17; 3 PRs (`42ddb42`/`8e8b7fb`/`66a8bc7`), prod-abgenommen          | `archive/hexaco-instrument/`       |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit.
**10xChampion (Modul 5): Projekt abgeschlossen + archiviert**, Lernmodul 3/5.
Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Doku-Push auf `main`** meldet `Bypassed rule violations — "ai-review/verdict" is expected`
  (Admin-Bypass, `enforce_admins: false`). Fuer Code den PR-Weg nehmen, nicht bypassen.
- **Zeilenenden:** `core.autocrlf=input` seit 2026-07-19 LOKAL gesetzt (Working Tree = LF).
  Global bleibt `true` — bei Massen-Prettier-Fehlern `Delete ␍` zuerst `git ls-files --eol` pruefen.
- **Squash-Merge:** danach **erst** `checkout main`, **dann** `reset --hard origin/main`
  (umgekehrt verbiegt `gh pr merge --delete-branch` den Branch-Zeiger). Kein `git pull`.
- **CI-`integration`-Flake:** Kong „invalid response from upstream" bei parallelen Inserts —
  einmaliger Job-Re-Run, erst bei zweitem Rot echt debuggen.
- **`kind`/`instrument_id` serverseitig gebunden**; **E2E lokal `--workers=1`**;
  **`ENCRYPTION_KEY` = `.dev.vars`/`.env`-Key**, sonst Laeufe 0/N.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:workflow-next` — kein aktives Item; danach voraussichtlich
`/dtb:feature-start` fuer Inbox-Idee #8 (SD3), Lizenz vorab verifizieren.
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
