# Workflow-Status: persona-forge

**Letztes Update:** 2026-08-03
**Letzter Session-Log:** `dtb-project/project-changelog/2026-08/2026-08-03.md` (Session 2)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature. (`features/` ist leer; letzter Change `ci-review-agent` archiviert
2026-08-03 → `context/archive/2026-07-08-ci-review-agent/`.)

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                                                                    |
| **Notizen** | Zertifizierung geprueft: **zwei** Formulare noetig (Builder · Architect+Champion gemeinsam), beide im selben Termin bis **10.08. 23:59**. Belegmaterial in `.ressources/certyfikacja/` (gitignored) inkl. Mapping-README. Repo ist public → kein Collaborator noetig. `main` = `bd254b2`. |

---

## Offene Aufgaben

- [ ] **Job-Log-Screenshot** — Kontext: anonym gesperrt (`Sign in to view logs`); eingeloggt auf `actions/runs/30705299779/job/91383267851`, Log liegt als Text vor
- [ ] **App-Screenshots (eingeloggt)** — Kontext: „screeny z aplikacji" fuers Builder-Formular — Dashboard, CRUD, Lauf mit Verteilung
- [ ] **Zwei Formulare absenden** — Kontext: bis 10.08. 23:59, Links in `.ressources/certyfikacja/README.md`; kein Nachreichen moeglich
- [ ] **Naechstes Feature waehlen** — Kontext: #8 SD3 empfohlen (Registry-Umbau kommt aus HEXACO), Lizenz Jones & Paulhus 2014 vorab verifizieren
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE
- [ ] **Housekeeping** — Docker Desktop beenden (optional)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                       | Ergebnis                                                                     | Details                            |
| ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| 2026-08-03 | **Zertifizierungs-Check + Belegmaterial**         | 2 Formulare statt 1; Builder/Architect vollstaendig, Champion bis auf 1 Shot | `2026-08-03.md` (S2)               |
| 2026-08-03 | **CI-Review-Agent archiviert (Champion M5L3 zu)** | PR #21 gemerged, Change archiviert (`4361839`), Lektion L4 (`f0a3187`)       | `2026-08-03.md` (S1)               |
| 2026-07-19 | Live-Run-Visualisierung end-to-end + abgenommen   | 9/9; PR #16 + Review-Fix #17 (7/7 FIXED); Prod-Abnahme per Screenshot        | `archive/live-run-visualisierung/` |

---

## Kurs-Standort (10xDevs)

Module 1–4 = **20/20 ✅**. **10xBuilder** + **10xArchitect** einreichbereit (Report +
alle vier M4-Artefakte vorhanden). **10xChampion (Modul 5): Projekt abgeschlossen +
archiviert**, Lernmodul 3/5. Termine: 2. = **10.08.** · 3. = 14.09.

---

## Gotchas (Referenz)

- **Zertifizierung:** zwei Formulare, ein Termin. Das allgemeine Kursdokument („formularz
  **jeden raz**") meint einen Anlauf, nicht ein Formular — massgeblich sind die neueren
  blockspezifischen Posts in `.ressources/infos/`.
- **GitHub-Actions-Logs** sind fuer Nicht-Eingeloggte gesperrt, auch bei public Repos —
  fuer Log-Belege entweder eingeloggt screenshotten oder `gh run view --log`.
- **Doku-Push auf `main`** meldet `Bypassed rule violations — "ai-review/verdict" is expected`
  (Admin-Bypass, `enforce_admins: false`). Fuer Code den PR-Weg nehmen, nicht bypassen.
- **Zeilenenden:** `core.autocrlf=input` seit 2026-07-19 LOKAL gesetzt (Working Tree = LF).
  Bei Massen-Prettier-Fehlern `Delete ␍` zuerst `git ls-files --eol` pruefen.
- **Squash-Merge:** danach **erst** `checkout main`, **dann** `reset --hard origin/main`.
- **`kind`/`instrument_id` serverseitig gebunden**; **E2E lokal `--workers=1`**;
  **`ENCRYPTION_KEY` = `.dev.vars`/`.env`-Key**, sonst Laeufe 0/N.

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:workflow-next` — kein aktives Item. Terminlich zuerst: die
zwei fehlenden Screenshots + Formularversand bis 10.08.; danach `/dtb:feature-start`
fuer Inbox-Idee #8 (SD3).
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
