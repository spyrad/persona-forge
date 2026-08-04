# Workflow-Status: persona-forge

**Letztes Update:** 2026-08-04
**Letzter Session-Log:** `dtb-project/project-changelog/2026-08/2026-08-04.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature. (`features/` ist leer; letzter Change `ci-review-agent` archiviert
2026-08-03 → `context/archive/2026-07-08-ci-review-agent/`.)

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                        |
| **Notizen** | Zertifizierungs-Belege **komplett** in `.ressources/certyfikacja/` (gitignored): Builder 7 Bilder, Champion 6 Bilder, Architect ueber `context/architect-report.md` im Repo. Mapping-README dort. Offen ist nur noch der Versand: **zwei** Formulare, beide bis 10.08. 23:59. |

---

## Offene Aufgaben

- [ ] **Zwei Formulare absenden** — Kontext: Builder + Architect/Champion im **selben** Termin bis 10.08. 23:59; kein Nachreichen; Links in `.ressources/certyfikacja/README.md`
- [ ] **Naechstes Feature waehlen** — Kontext: #8 SD3 empfohlen (Registry-Umbau kommt aus HEXACO), Lizenz Jones & Paulhus 2014 vorab verifizieren
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE
- [ ] **Housekeeping** — Docker Desktop beenden; im Playwright-Fenster abmelden (optional)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                       | Ergebnis                                                               | Details              |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------- | -------------------- |
| 2026-08-04 | **Zertifizierungs-Belege komplett**               | 13 Artefakte fuer 3 Badges; Log-Screenshots via eingeloggtem Browser   | `2026-08-04.md`      |
| 2026-08-03 | **Zertifizierungs-Check**                         | 2 Formulare statt 1; Bereitschaft je Badge geprueft                    | `2026-08-03.md` (S2) |
| 2026-08-03 | **CI-Review-Agent archiviert (Champion M5L3 zu)** | PR #21 gemerged, Change archiviert (`4361839`), Lektion L4 (`f0a3187`) | `2026-08-03.md` (S1) |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** + **10xChampion** vollstaendig
belegt — es fehlt nur der Formularversand. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Zertifizierung:** zwei Formulare, ein Termin. Das allgemeine Kursdokument („formularz
  **jeden raz**") meint einen Anlauf, nicht ein Formular — massgeblich sind die neueren
  blockspezifischen Posts in `.ressources/infos/`.
- **Eingeloggte Screenshots ohne Passwort-Weitergabe:** Playwright-MCP headed oeffnen,
  Nutzer meldet sich im Fenster selbst an, Agent uebernimmt danach die Navigation.
- **GitHub-Actions-Logs** sind fuer Nicht-Eingeloggte gesperrt, auch bei public Repos —
  eingeloggt screenshotten oder `gh run view --log`.
- **Doku-Push auf `main`** meldet `Bypassed rule violations — "ai-review/verdict" is expected`
  (Admin-Bypass, `enforce_admins: false`). Fuer Code den PR-Weg nehmen, nicht bypassen.
- **Zeilenenden:** `core.autocrlf=input` lokal (Working Tree = LF); bei Massen-Prettier-Fehlern `Delete ␍` zuerst `git ls-files --eol` pruefen.
- **Squash-Merge:** danach **erst** `checkout main`, **dann** `reset --hard origin/main`.
- **`kind`/`instrument_id` serverseitig gebunden**; **E2E lokal `--workers=1`**;
  **`ENCRYPTION_KEY` = `.dev.vars`/`.env`-Key**, sonst Laeufe 0/N.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:workflow-next` — kein aktives Item. Terminlich zuerst der
Formularversand bis 10.08.; danach `/dtb:feature-start` fuer Inbox-Idee #8 (SD3).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
