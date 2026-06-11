---
name: 10x-course-status
description: >
  Read-only Kurs-Standort-Report für den 10xDevs-Kurs: mappt die Lektionen aus
  .ressources/lekcje/ pro Modul auf den Projektstand (Artefakt-Evidenz) und zeigt
  den nächsten Kurs-Schritt. Trigger: "Kurs-Status", "wo stehen wir im Kurs",
  "Kurs-Standort", "Lektions-Status", "course status", "gdzie jesteśmy w kursie",
  "welche Lektion", "Modul-Fortschritt", "welche Skills gehören zu Lektion X",
  "Skills je Lektion". NICHT für Projekt-Workflow-Status —
  das ist /dtb:workflow-status.
argument-hint: "[modul 1..4]"
allowed-tools:
  - Read
  - Glob
  - Grep
---

# 10x Course-Status

Kurs-GPS für 10xDevs: Welche Lektion ist erledigt, wo stehen wir, was kommt als Nächstes.

## Schritt 1: Lektionsliste laden

`Glob .ressources/lekcje/*.md` im Projekt-Root. Modul + Episode aus dem Dateinamen
parsen — beide Formate tolerieren: `s01e01-titel.md` **und** `s03-e01-titel.md`
(Regex-Idee: `^s(\d{2})-?e(\d{2})-(.+)\.md$`). Titel = Rest des Dateinamens
(Polnisch, unverändert übernehmen). `s00e00/` (Prework) nicht als Modul listen,
nur als Fußnote erwähnen.

Falls `.ressources/lekcje/` fehlt: ausgeben
`Kein Kurs-Material gefunden (.ressources/lekcje/ fehlt).` — und abbrechen.

## Schritt 2: Skill-Mapping je Lektion

Ein einziger Grep-Aufruf über `.ressources/lekcje/*.md` (ohne `s00e00/`):
Pattern `/10x-[a-z0-9-]+` mit `output_mode: content` und `-o: true` — liefert
`datei:match`-Zeilen. **Ziffern im Pattern sind Pflicht**, sonst wird `/10x-e2e`
zu `/10x-e` abgeschnitten.

Je Lektionsdatei: Treffer zählen, `/10x-cli` ausschließen (CLI-Tool, kein Skill),
nach Häufigkeit absteigend sortieren.

- **Haupt-Skills** = Top-Treffer; max. 3 je Lektion.
- Treffer mit nur 1 Erwähnung weglassen, wenn es häufigere gibt
  (Querverweis-Rauschen auf andere Lektionen).
- Lektion ohne Treffer: `—`.

## Schritt 3: Projekt-Evidenz scannen

Nur Existenz prüfen bzw. wenige Zeilen lesen:

- `context/foundation/`: `shape-notes.md`, `prd.md`, `tech-stack.md`, `roadmap.md`, `test-plan.md`
- `context/changes/*/plan.md` und `context/archive/*/` (abgeschlossene Changes)
- `CLAUDE.md`, `CLAUDE.md.scaffold` (Scaffold-Sibling noch nicht gemergt = s01e04 unfertig)
- `workflow.config.yaml`: `test_command` gesetzt oder `null`?
- `WORKFLOW_STATUS.md`: Sektion "Kurs-Standort" + Blocker (Korrektiv, nicht primäre Quelle)

## Schritt 4: Status je Lektion ableiten

| Lektion | Evidenz für ✅ |
|---|---|
| s01e01 (PRD) | `shape-notes.md` **und** `prd.md` existieren |
| s01e02 (Tech-Stack) | `tech-stack.md` existiert |
| s01e03 (Bootstrap) | Scaffold vorhanden (`package.json` + `astro.config.mjs`) |
| s01e04 (Onboarding) | `CLAUDE.md` existiert und **kein** `CLAUDE.md.scaffold` mehr; sonst 🔶 |
| s01e05 (Deployment) | Live-URL laut WORKFLOW_STATUS bzw. archivierte deploy-Change |
| s02e01 (Roadmap) | `roadmap.md` existiert |
| s02e02 (Plan→Code) | mind. eine `context/changes/*/plan.md` implementiert/archiviert |
| s02e03–e05 | zugehörige Changes/Review-Artefakte vorhanden, sonst ⬜ |
| s03e01–e05 (Tests) | `test-plan.md` bzw. `test_command` gesetzt + Test-/E2E-Artefakte |
| s04e01–e05 (Legacy) | Brownfield-Artefakte (Projektkarte, Refactoring-Changes), sonst ⬜ |

**Statuswerte:** ✅ erledigt · 🔶 teilweise · ⏭️ aktuelle Position (erste nicht-✅
Lektion in Kursreihenfolge) · ⬜ offen.

Bei Widerspruch zwischen Artefakt-Evidenz und WORKFLOW_STATUS-Prosa: **Evidenz
gewinnt**, Abweichung als einzeiligen Hinweis ausgeben.

## Schritt 5: Zertifizierungs-Deadline (optional)

Falls `.ressources/infos/**/wszystko-o-projekcie-zaliczeniowym*.md` existiert
(Achtung: jede Info liegt in einem eigenen Unterordner): die nächstgelegene
zukünftige Deadline herauslesen und als eine Zeile anhängen.

## Schritt 6: Output

### Ohne Argument (max ~45 Zeilen)

```
# Kurs-Standort: 10xDevs

**Position:** {1 Satz, z. B. "Übergang Modul 1 → Modul 2 (s02e02)"}

## Modul {N} — {Kurztitel} ({x}/{y})
| Lektion | Thema | Skills | Status |
|---|---|---|---|
| s0Ne0M | {Titel aus Dateiname} | {Haupt-Skills aus Schritt 2, max 3} | {✅/🔶/⏭️/⬜ + 3-5 Wörter Evidenz} |

**Nächster Kurs-Schritt:** {Lektion} → {konkreter Skill-Aufruf, z. B. /10x-plan deploy-skeleton-live}
**Zertifizierung:** nächste Deadline {Datum}   (nur falls gefunden)
```

### Mit Argument (`1`–`4`)

Nur dieses Modul, je Lektion 1–2 Zeilen mit konkreter Evidenz
(welche Datei vorhanden/fehlt, was noch zu tun ist) plus **alle** gefundenen
Skills der Lektion (nicht nur Top-3), Haupt-Skill zuerst markiert.

## Richtlinien

- **Read-only:** ändert keine Dateien
- **Keine Rückfragen:** sofort Output liefern
- **Deutsch**, Lektionstitel bleiben Polnisch
- **Keine Zeitschätzungen**, keine Kalender-Planung
- **Prework:** nur Fußnote (`s00e00: Prework, nicht Teil des Modul-Zählers`)

## Verwandte Skills

- `/dtb:workflow-status` — Projekt-Pipeline (nicht Kurs)
- `/dtb:workflow-next` — nächste Aktion pro Feature
- `/10x-roadmap` — Produkt-Roadmap aus PRD

---

Scanne jetzt `.ressources/lekcje/` und die Projekt-Artefakte und zeige den Kurs-Standort.
