# Derived State — Ableitungsregeln

> **Single Source fuer die Statusableitung.** Alle Lese-Skills (`dtb:workflow-next`,
> `dtb:workflow-status`, `dtb:workflow-resume`, `dtb:backlog-status`) leiten den
> Feature-Status nach DIESEN Regeln aus Artefakten ab. Keine eigene Logik in Skills —
> Aenderungen nur hier.

**Grundprinzip:** Status wird nicht gespeichert, sondern abgeleitet. Quelle der Wahrheit
ist **ein Ordner pro Change** unter `features/<slug>/` mit fixen Dateinamen und die
`## Progress`-Checkboxen in `plan.md` — nicht Statusfelder in BACKLOG.md oder WORKFLOW_STATUS.md.

**Change-Folder-Modell:** Jeder Change ist ein Ordner `features/<slug>/` (Slug in kebab-case,
Regeln in §4) mit festen Dateinamen:

| Datei          | Inhalt                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| `discovery.md` | Discovery (Anforderungs-Klaerung, optional)                                |
| `spec.md`      | Feature-Spec (Was/Warum)                                                   |
| `plan.md`      | Implementierungsplan inkl. `## Progress` (Umsetzungsstand)                 |
| `bug.md`       | Bug-Report inkl. `## Fix-Schritte` (statt eigenem Ordner-Change fuer Bugs) |
| `task.md`      | Aufgabe inkl. `## Schritte`                                                |

Ein archivierter Change ist der ganze Ordner unter `archive/<slug>/`.

---

## 1. Ableitungsregel

### 1.1 Vorhandene Ordner-Dateien → Pipeline-Stage

Pro Change-Ordner `features/<slug>/` gilt die **hoechste** zutreffende Zeile:

| Vorhandene Dateien im Ordner        | Abgeleiteter Status |
| ----------------------------------- | ------------------- |
| kein Ordner (nur INBOX-Eintrag)     | Idee                |
| nur `discovery.md`                  | In Discovery        |
| `spec.md` (ohne `plan.md`)          | Spezifiziert        |
| `plan.md`, 0 Checkboxen abgehakt    | Geplant             |
| `plan.md`, teilweise abgehakt       | In Arbeit           |
| `plan.md`, alle Checkboxen abgehakt | Fertig zum Testen   |
| Ordner unter `archive/<slug>/`      | Abgeschlossen       |

### 1.2 Explizite Zustaende (nicht ableitbar)

Diese Zustaende sind bewusste Nutzer-Entscheidungen und ueberschreiben die Ableitung:

- **Pausiert** — manuelle Markierung (WORKFLOW_STATUS "Pausierte Themen" oder BACKLOG-Anmerkung)
- **Abgenommen / Abgeschlossen** — nur via `/dtb:archive`; 100% Checkboxen ≠ automatisch abgeschlossen

### 1.3 Konfliktregel

Widerspricht ein manuelles Statusfeld (z.B. in BACKLOG.md) dem abgeleiteten Zustand:

1. **Das Artefakt gewinnt.** Reports zeigen den abgeleiteten Status.
2. **Der Widerspruch wird gemeldet** (1 Hinweiszeile im Report), nie stillschweigend uebergangen.
3. Lese-Skills korrigieren das Feld NICHT selbst (read-only) — Korrektur erfolgt beim
   naechsten schreibenden Skill (`workflow-checkpoint`) oder manuell.

### 1.4 Fallbacks (Altbestand, defekte Daten)

Kein Fallback fuehrt zum Abbruch — immer definiertes Verhalten:

| Situation                                                                       | Verhalten                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `plan.md` ohne `## Progress`-Sektion                                            | Status "Plan vorhanden, Fortschritt unbekannt"; Nachruestung anbieten                                   |
| `## Progress` mit 0 Checkbox-Zeilen                                             | wie "keine Sektion"                                                                                     |
| Ordner mit `plan.md` ohne `spec.md`                                             | Meldung "Change ohne Spec" (Vollstaendigkeit pruefen)                                                   |
| leerer Change-Ordner                                                            | ignorieren + Hinweis                                                                                    |
| **flache Alt-Dateien** (`FEATURE_*.md`, `PLAN_*.md` etc. direkt in `features/`) | Altbestand vor Migration; ignorieren fuer Ableitung; Migration anbieten (`/dtb:migrate-change-folders`) |
| **`IMPL_STATUS_*.md`** (Altbestand, abgeschafft)                                | ignorieren; Migration anbieten                                                                          |
| gar keine Change-Ordner in `features/`                                          | "Kein aktives Feature"                                                                                  |

### 1.5 Sonderregel `task.md` / `bug.md`

Aufgaben und Bugs haben keinen separaten Plan — ihre Checkliste steht **direkt in der Datei**
(`## Schritte` in `task.md` bzw. `## Fix-Schritte` in `bug.md`). Ableitung analog: 0 abgehakt =
Offen/Analysiert (bug) bzw. Offen (task), teilweise = In Arbeit, alle abgehakt = **Behoben**
(`bug.md`) bzw. **Erledigt** (`task.md`). Es zaehlen ausschliesslich die Checkboxen unter
`## Fix-Schritte`/`## Schritte` — ein separater `## Testplan` in `bug.md` wird NICHT mitgezaehlt.
Explizite Statusfelder im
Kopf dieser Dateien gelten als manuelle Zustaende nach 1.2 nur fuer: Pausiert. Ein Change-Ordner
kann `spec.md`/`plan.md` **und** `bug.md`/`task.md` enthalten (z.B. Bug im Zuge eines Features);
die Ableitung nach 1.1 (plan-basiert) hat dann Vorrang, `bug.md`/`task.md` sind Zusatz-Artefakte.

---

## 2. Progress-Sektion — Format & Verifikations-Gate

Jedes `plan.md` enthaelt eine `## Progress`-Sektion (erzeugt von `dtb:impl-plan`):

```markdown
## Progress

- [ ] 1.1 Kurzname des Schritts
- [x] 1.2 Kurzname des Schritts — `a1b2c3d`
- [x] 1.3 Doku-Schritt ohne Commit
- [x] 2.1 Geflippt, Phase laeuft noch (SHA folgt beim Phasen-Commit)
```

**Regeln:**

1. **Eine Zeile pro Plan-Schritt**, Nummerierung identisch zu den Schritten im Plan (N.M)
2. **Checkbox-Syntax:** `- [ ]` offen, `- [x]` erledigt — keine anderen Marker
3. **Flip-Bedingung (Verifikations-Gate):** Eine Checkbox darf erst geflippt werden, wenn der
   Schritt umgesetzt ist UND kein **Automated**-Checkpoint-Kriterium seiner Phase verletzt ist
   (rotes Kriterium → erst fixen, dann abhaken). Checkpoint-Kriterien einer Phase sind
   unterteilt in **Automated** (mechanisch pruefbar: Kommando, Grep, Datei-Existenz) und
   **Manual** (menschliches Urteil, am Phasen-Ende bestaetigt — Ritual in `dtb:implement`).
   Fehlen Kriterien oder sind sie ungeteilt (Alt-Plan): alle als Manual behandeln —
   das Gate entfaellt nie, es wandert zum Menschen (kein Abbruch, vgl. §1.4)
4. **Commit-SHA als Verifikations-Beleg:** nach `—` als Inline-Code (`` `a1b2c3d` ``,
   Kurzform 7 Zeichen). Die SHA wird NICHT beim Abhaken gesetzt, sondern beim
   Phasen-Ende-Commit in alle waehrend der Phase geflippten Zeilen nachgetragen —
   sie belegt damit die verifizierte Phase, nicht nur den Commit. Eine geflippte Zeile
   ohne SHA ist mid-phase ein gueltiger Zwischenzustand. Schritte/Phasen ohne Commit
   (reine Doku/Verifikation, leerer Diff) bleiben dauerhaft SHA-los
5. **Multi-Repo:** Die SHA einer Zeile stammt aus dem Repo des jeweiligen Schritts;
   mehrere SHAs pro Phase sind zulaessig. In Multi-Repo-Projekten (mehr als ein Eintrag
   in `config.repos`) traegt die SHA ein Repo-Praefix im Inline-Code
   (`` `repo-name@a1b2c3d` ``); bei Single-Repo-Projekten bleibt das Format ohne Praefix
6. **Gebuendelte Commits:** ein Commit darf mehrere Checkboxen belegen (gleiche SHA an
   mehreren Zeilen zulaessig)
7. **Kompakt:** max ~30 Zeilen, keine Prosa — Details gehoeren in die Plan-Schritte
8. **Manuelles Abhaken erlaubt:** auch der Mensch darf Checkboxen setzen (Artefakt = Wahrheit);
   die Flip-Bedingung (Regel 3) gilt dabei genauso
9. **Abhaken ist Teil des Implementierungs-Loops:** nach jedem umgesetzten Schritt gemaess
   Flip-Bedingung, nicht gesammelt am Session-Ende; der SHA-Nachtrag erfolgt am Phasen-Ende
   (Regel 4)

---

## 3. Statusmodell — Mapping auf die BACKLOG-Legende

Abgeleitete Zustaende und ihre Anzeige in Reports/BACKLOG:

| Abgeleiteter Status | BACKLOG-Legende   | Anzeige-Hinweis                             |
| ------------------- | ----------------- | ------------------------------------------- |
| Idee                | Idee              | nur INBOX/BACKLOG-Zeile, kein Ordner        |
| In Discovery        | Idee              | Zusatz "(in Discovery)"                     |
| Spezifiziert        | Idee              | Zusatz "(Spec erstellt)" — noch kein Plan   |
| Geplant             | Geplant           | Plan existiert, 0% umgesetzt                |
| In Arbeit           | In Arbeit         | Zusatz "X/Y Schritte" aus Checkbox-Zaehlung |
| Fertig zum Testen   | Fertig zum Testen | 100% Checkboxen; wartet auf Abnahme         |
| Abgenommen          | Abgenommen        | explizit (1.2)                              |
| Abgeschlossen       | Abgeschlossen     | explizit via `/dtb:archive`                 |
| Pausiert            | Pausiert          | explizit (1.2), ueberschreibt Ableitung     |

**Statusfeld in BACKLOG.md** ist abgeleitete **Anzeige**: schreibende Skills befuellen es
beim naechsten Lauf nach diesen Regeln; manuell gepflegt werden nur Prio und Ziel.

---

## 4. Slug-Ableitung (Change-Ordnername)

Der Ordnername `features/<slug>/` wird aus dem Change-/Feature-Namen abgeleitet.

**Ableitung (deterministisch):**

1. Alles klein schreiben (lowercase)
2. Unterstriche `_` und Leerzeichen → Bindestrich `-`
3. Alle Zeichen ausser `a-z`, `0-9`, `-` entfernen
4. Mehrfache `-` zu einem zusammenfassen; fuehrende/abschliessende `-` strippen

Beispiele: `CHANGE_FOLDER_MODELL` → `change-folder-modell`; `Chat History` → `chat-history`;
`FINN_MIS_AWARENESS` → `finn-mis-awareness`.

**Regeln:**

- **Keine laufenden Nummern** — reine Namens-Slugs (die INBOX-`#` bleibt die ID; der Ordner
  traegt keinen Zahlenpraefix)
- **Kebab-case, stabil:** einmal vergeben bleibt der Slug fix (Umbenennung = bewusster `git mv`)
- **Eindeutigkeit / Kollision:** Leiten zwei verschiedene Change-Namen denselben Slug ab
  (z.B. `FOO_BAR` und `FOO-BAR` → beide `foo-bar`), ist das eine **Kollision**. Schreibende
  Skills und der Migrations-Helfer **brechen ab** und melden die kollidierenden Namen — kein
  automatisches Anhaengen von Suffixen/Nummern. Der Nutzer benennt eine Quelle bewusst um.

---

## 5. Roadmap-Ableitung (ROADMAP.md-Statusspalte)

Die von `dtb:greenfield-roadmap` erzeugte `project-strategy/ROADMAP.md` fuehrt je Slice/Foundation
eine **Change-ID in kebab-case = kuenftiger Feature-Slug** (§4). Die **Status-Spalte** in der
At-a-glance-Tabelle ist eine **abgeleitete Anzeige** („nicht manuell pflegen") — analog §3.

### 5.1 Ableitung (Change-ID → Slug → Ordner-Zustand)

Pro Roadmap-Item gilt die **hoechste** zutreffende Zeile (`<slug>` = Change-ID des Items):

| Zustand im Projekt                            | Abgeleiteter Roadmap-Status                           |
| --------------------------------------------- | ----------------------------------------------------- |
| Ordner `archive/<slug>/` existiert            | `done`                                                |
| Ordner `features/<slug>/` existiert           | `in-progress`                                         |
| kein Ordner (Item noch nicht in der Pipeline) | **Doc-Status** gilt: `proposed` / `ready` / `blocked` |

Der **Doc-Status** ist der einzige manuell (vom Roadmap-Autor) gesetzte Wert und gilt nur, solange
kein Change-Ordner existiert. Sobald `feature-discover` einen Ordner anlegt, gewinnt der abgeleitete
`in-progress`; ein archivierter Change wird `done`. Vokabular einheitlich **englisch**
`proposed / ready / blocked / in-progress / done` (Entscheidung F; konsistent zu `S-NN`/`F-NN`).

### 5.2 Konflikt & Sync

- **Konfliktregel §1.3 gilt analog:** Widerspricht die gesetzte Statusspalte dem abgeleiteten
  Zustand, gewinnt das Artefakt (der Ordner-Zustand); lesende Roadmap-Laeufe (Report-Modus) melden
  den Widerspruch mit 1 Hinweiszeile und korrigieren nicht selbst.
- **Sync:** `dtb:workflow-checkpoint` synchronisiert die Spalte beim naechsten Lauf (nur wenn
  `ROADMAP.md` existiert) — dieselbe Mechanik wie die BACKLOG-Spalte, **keine** `dtb:archive`-Kopplung.

---

**Eingefuehrt mit:** Feature DERIVED_STATE (`features/FEATURE_DERIVED_STATE.md`), 2026-07-06
**Umgestellt auf Change-Folder-Modell:** Feature CHANGE_FOLDER_MODELL, 2026-07-09
**§5 Roadmap-Ableitung ergaenzt:** Feature greenfield-autoren-skills, 2026-07-13
**§2 gehaertet (Verifikations-Gate: Flip-Bedingung, SHA-Timing, Multi-Repo-SHA):** Feature verifikations-gate, 2026-07-15
