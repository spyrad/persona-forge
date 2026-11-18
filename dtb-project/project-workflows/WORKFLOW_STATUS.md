# Workflow-Status: persona-forge

**Letztes Update:** 2026-11-18
**Letzter Session-Log:** `dtb-project/project-changelog/2026-11/2026-11-18.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature.

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                              |
| **Notizen** | `.claude/skills/` seit PR #22 (`e04aefd`) nicht mehr versioniert — lokal vorhanden, frische Klone haben die 10x-Skills nicht (#11). |

---

## Offene Aufgaben

- [ ] **Feedback abwarten** — Kontext: bis ca. 24.08.; Plattform-Nachrichten pruefen (Demo-Day-Einladungen gehen individuell raus) (seit ≤2026-08-05) ⏳
- [ ] **Naechstes Feature waehlen** — Kontext: #8 SD3 empfohlen (Registry-Umbau kommt aus HEXACO), Lizenz Jones & Paulhus 2014 vorab verifizieren (seit ≤2026-08-05) ⏳
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE (seit ≤2026-07-11) ⏳
- [ ] **Housekeeping** — Kontext: im Playwright-Fenster abmelden, Docker Desktop beenden (optional) (seit ≤2026-07-03) ⏳

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                    | Ergebnis                                                       | Details         |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------- | --------------- |
| 2026-11-18 | `.claude/skills/` aus dem Repo genommen        | PR #22 gemerged (`e04aefd`), Skills lokal erhalten, Lektion L5 | `2026-11-18.md` |
| 2026-08-05 | **Zertifizierung eingereicht (alle 3 Badges)** | 2 Formulare im 2. Termin; Report als PDF+MD, 13 Screenshots    | `2026-08-05.md` |
| 2026-08-04 | Zertifizierungs-Belege komplett                | App-, Log- und Test-Screenshots erzeugt                        | `2026-08-04.md` |

---

## Gotchas (Referenz)

- **Nicht wiederherstellbare UI-Zustaende** (ausgefuellte Formulare) nie auf Zuruf
  verlassen: Zustand selbst pruefen, bevor man navigiert.
- **Eingeloggte Screenshots ohne Passwort-Weitergabe:** Playwright-MCP headed oeffnen,
  Nutzer meldet sich im Fenster selbst an, Agent uebernimmt die Navigation.
- **GitHub-Actions-Logs** sind fuer Nicht-Eingeloggte gesperrt, auch bei public Repos.
- **Doku-Push auf `main`** meldet `Bypassed rule violations` (Admin-Bypass). Fuer Code
  den PR-Weg nehmen. **Squash-Merge:** erst `checkout main`, dann `reset --hard origin/main`.
- **`gh pr merge` blockt der Auto-Modus** bei loeschenden PRs — Merge per Klick im Browser.
- **`ENCRYPTION_KEY` = `.dev.vars`/`.env`-Key**, sonst Laeufe 0/N; **E2E lokal `--workers=1`**
  und braucht laufendes lokales Supabase (Docker).

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:workflow-next`
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
