# Workflow-Status: persona-forge

**Letztes Update:** 2026-08-05
**Letzter Session-Log:** `dtb-project/project-changelog/2026-08/2026-08-05.md` (Session 1)

---

## Status (generiert aus Artefakten — nicht manuell editieren)

Kein aktives Feature. (`features/` ist leer; letzter Change `ci-review-agent` archiviert
2026-08-03 → `context/archive/2026-07-08-ci-review-agent/`.)

---

## Kontext (manuell)

| Kennzahl    | Wert                                                                                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocker** | Keine.                                                                                                                                                                                                                                        |
| **Notizen** | Zertifizierung **abgeschlossen**: beide Formulare am 2026-08-05 abgesendet (Builder · Architect+Champion), alle drei Badges im 2. Termin beantragt. Feedback-Frist bis ca. 24.08., Stille = bestanden. Belege in `.ressources/certyfikacja/`. |

---

## Offene Aufgaben

- [ ] **Feedback abwarten** — Kontext: bis ca. 24.08.; Plattform-Nachrichten pruefen (Demo-Day-Einladungen gehen individuell raus)
- [ ] **Naechstes Feature waehlen** — Kontext: #8 SD3 empfohlen (Registry-Umbau kommt aus HEXACO), Lizenz Jones & Paulhus 2014 vorab verifizieren
- [ ] **Ideen-Inbox** (offen): #1 Task-based evals, #6 Combobox-Ersatz, #7 UI-Konzepte, #8 SD3, #9 HEXACO-100, #10 Repo-LICENSE
- [ ] **Housekeeping** — im Playwright-Fenster abmelden, Docker Desktop beenden (optional)

---

## Abgeschlossene Meilensteine (kompakt)

| Datum      | Meilenstein                                    | Ergebnis                                                               | Details         |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------- | --------------- |
| 2026-08-05 | **Zertifizierung eingereicht (alle 3 Badges)** | 2 Formulare im 2. Termin; Report als PDF+MD, 13 Screenshots            | `2026-08-05.md` |
| 2026-08-04 | Zertifizierungs-Belege komplett                | App-, Log- und Test-Screenshots erzeugt                                | `2026-08-04.md` |
| 2026-08-03 | CI-Review-Agent archiviert (Champion M5L3 zu)  | PR #21 gemerged, Change archiviert (`4361839`), Lektion L4 (`f0a3187`) | `2026-08-03.md` |

---

## Kurs-Standort (10xDevs)

Module 1–5 durchgearbeitet. **10xBuilder + 10xArchitect + 10xChampion beantragt**
(2. Termin, 10.08.) — Bewertung laeuft, Feedback bis ca. 24.08. Kein Nachreichen
moeglich und keines noetig.

---

## Gotchas (Referenz)

- **Nicht wiederherstellbare UI-Zustaende** (ausgefuellte Formulare) nie auf Zuruf
  verlassen: Zustand selbst pruefen, bevor man navigiert — ein Seitenwechsel hat das
  fertige Builder-Formular verworfen.
- **Baserow-Uploads:** „Eine Datei hinzufuegen" oeffnet ein In-Page-Modal mit eigenem
  „Hochladen"-Knopf; der Klick direkt in die Dropzone loest sofort den Dateidialog aus.
- **Eingeloggte Screenshots ohne Passwort-Weitergabe:** Playwright-MCP headed oeffnen,
  Nutzer meldet sich im Fenster selbst an, Agent uebernimmt die Navigation.
- **GitHub-Actions-Logs** sind fuer Nicht-Eingeloggte gesperrt, auch bei public Repos.
- **MD→PDF ohne neue Abhaengigkeit:** remark/rehype (+`remark-gfm`) aus Astros Baum +
  headless Chromium aus `playwright`; Skript muss im Projektbaum liegen (ESM-Aufloesung).
- **Doku-Push auf `main`** meldet `Bypassed rule violations` (Admin-Bypass). Fuer Code
  den PR-Weg nehmen. **Squash-Merge:** erst `checkout main`, dann `reset --hard origin/main`.
- **`ENCRYPTION_KEY` = `.dev.vars`/`.env`-Key**, sonst Laeufe 0/N; **E2E lokal `--workers=1`**
  und braucht laufendes lokales Supabase (Docker).

---

## Pausierte Themen

Keine.

---

## Handoff

**Naechster Befehl:** `/dtb:feature-start` fuer Inbox-Idee **#8 (SD3)** — Lizenz
(Jones & Paulhus 2014) vor der Spec verifizieren; alternativ `/dtb:workflow-next`.
**Empfehlung:** Neue Session mit `/clear` starten, dann `/dtb:workflow-resume` (stellt Kontext her), danach obigen Befehl.
