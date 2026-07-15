# Implementierungsplan: Dashboard Mission Control

**Erstellt:** 2026-07-15
**Feature-Spec:** `features/dashboard-mission-control/spec.md`
**Geschaetzte Dauer:** 2–3 Sessions (~10 h)
**Status:** Reviewed <!-- plan-review 2026-07-15: REVISE → 8 Entscheidungen mit Damian, Anpassungen eingearbeitet -->

---

## Phasen-Uebersicht

| Phase   | Beschreibung                                                | Dauer  | Status  |
| ------- | ----------------------------------------------------------- | ------ | ------- |
| Phase 1 | Daten-Grundlage: Dashboard-Summary-Service                  | ~2 h   | Geplant |
| Phase 2 | Register: server-gerenderte Kennzahl-Zeilen statt 3 Kacheln | ~3 h   | Geplant |
| Phase 3 | Hero: server-gerendertes SVG mit CSS-Animation              | ~3–4 h | Geplant |
| Phase 4 | Absicherung + Abnahme (E2E, PR, Prod-Sichtpruefung)         | ~2 h   | Geplant |

---

## Ist-Analyse

> Quelle: `discovery.md` (Pfade verifiziert) + Code-Verifikation gemaess Lektion L1.

| Pfad                                     | Ist-Befund (relevant fuer den Plan)                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/dashboard.astro`              | 3 statische Link-Kacheln (`tiles`-Array), komplett server-gerendert, `AppLayout` mit `width="full"`, keinerlei Datenzugriff                                                                                                                                                                                                                                   |
| `src/lib/services/model-profiles.ts`     | `listModelProfiles` liefert NUR `modelName/runCount/usableReps/instruments` — **kein** `modalType`/`typeConsistency`/`lastRunAt`. Volle Profile (`ModelProfileView` mit `meta` + `sections[].aggregate`) nur via internes `loadProfiles`; `getModelProfiles` verlangt konkrete Namen. Batch-Queries, kein N+1. `loadProfiles` laedt die Configs intern selbst |
| `src/lib/services/runs.ts`               | `listRuns(sb, userId)` = sichtbare Laeufe (eigene + globale, RLS), `created_at` absteigend; laedt ALLE Zeilen — fuer eine Kennzahl zu teuer (→ Count-Query, Entscheidungstabelle)                                                                                                                                                                             |
| `src/lib/services/personas.ts`           | `listPersonas(sb, userId)` = eigene + globale (RLS); Kennzahl = Katalog-Groesse                                                                                                                                                                                                                                                                               |
| `src/lib/services/model-configs.ts`      | `listModelConfigs(sb)` = eigene Configs (owner-only); unprofilierte Modelle = Config-`modelName`s ohne Profil                                                                                                                                                                                                                                                 |
| `src/components/models/ModelProfile.tsx` | Typ + „Stability: N % of repetitions…" aus `aggregate.modalType`/`typeConsistency`; OEJTS-Attribution-Markup Zeile 140–157 (dupliziert auch in `ModelComparison.tsx` 267–283)                                                                                                                                                                                 |
| `src/lib/models/profile-link.ts`         | `modelProfileHref(modelName)` — zentrales Encoding fuer `/models/profile?m=…` (wiederverwenden)                                                                                                                                                                                                                                                               |
| `src/styles/global.css`                  | Semantische Tokens inkl. `--chart-1` (Teal) / `--chart-2` (Amber); `.dark`-Variante; `page-enter`-Animation vorhanden — SVG nutzt Tokens direkt via `var(…)`/`currentColor`                                                                                                                                                                                   |
| `src/layouts/AppLayout.astro`            | Props `eyebrow/heading/lead/width` — Dashboard-Format (eyebrow „01 — overview") bleibt nutzbar, kein Umbau noetig                                                                                                                                                                                                                                             |
| `sentry.server.config.ts`                | Sentry-Worker-Entry existiert — ERR-Pfade koennen loggen (Entscheidung Review)                                                                                                                                                                                                                                                                                |

**L1-Befund (Datenmodell):** „Typ + Stabilitaet je Modell" ist in der Listen-Sicht
NICHT vorhanden — der Plan baut deshalb auf den vollen Profilen auf (Phase 1),
statt `ModelProfileListItem` stillschweigend fuer ausreichend zu halten.

**Review-Befund (Architektur, 2026-07-15):** Hero als SVG + CSS statt Canvas-Insel —
vollstaendig server-gerendert, Animation rein per CSS. Damit entfallen: React-Insel,
Hydration-Delay, `getComputedStyle`-Token-Auslesen, Theme-Observer, DPR-Handling,
eigenes reduced-motion-Handling. Spec-Kriterium „nichts springt nach" ist per
Konstruktion erfuellt.

---

## Phase 1: Daten-Grundlage — Dashboard-Summary-Service

### Ziel

EIN testbarer Service-Einstiegspunkt liefert alle Dashboard-Kennzahlen aus
wenigen gebatchten Abfragen — mit Teilausfall je Quelle (ERR-Zustand + Sentry)
statt Seiten-Crash.

### Schritte

#### Schritt 1.1: Volle Profile exportierbar machen

- **Zweck:** Dashboard braucht `modalType`/`typeConsistency`/`lastRunAt` je Modell (L1-Befund); dafuer fehlt ein Export ohne Namens-Filter
- **Dateien:** `src/lib/services/model-profiles.ts`
- **Input:** bestehendes `loadProfiles`
- **Output:** exportiertes `getAllModelProfiles(sb)` (duenner Wrapper um `loadProfiles(sb)`, JSDoc analog Bestand)

#### Schritt 1.2: `getDashboardSummary` bauen (reiner Kern + DI)

- **Zweck:** Kennzahlen buendeln; Teilausfall-Prinzip der Spec umsetzen; Ausfaelle beobachtbar machen
- **Dateien:** NEU `src/lib/services/dashboard.ts`; Types in `src/types.ts` (`DashboardSummary`, je Quelle `{ data } | { error: true }`)
- **Input:** Quellen als injizierbare Abhaengigkeiten (Muster `buildModelProfiles`: reiner Kern, duenner Wrapper): `getAllModelProfiles`, `listModelConfigs`, `listPersonas`, NEU Runs-Kennzahl als **Count-Query** (`count: "exact", head: true`) + juengster Lauf (`limit 1`, `created_at` absteigend) statt `listRuns`-Volllast
- **Output:** `DashboardSummary`: profilierte Modelle (Name, Typ, Stabilitaet, usableReps, lastRunAt), unprofilierte Config-Modelle (Differenz ueber `model_name`), Personas-Anzahl, Runs-Anzahl + juengster Lauf-Zeitstempel. Quellen parallel via `Promise.allSettled`; **jeder catch-Pfad loggt ein Sentry-Event** (eine Zeile), damit dauerhafte ERR-Zustaende nicht unbemerkt bleiben

#### Schritt 1.3: Unit-Tests fuer den Summary-Service

- **Zweck:** Kern-Logik (Differenz profiliert/unprofiliert, Teilausfall-Mapping, juengster Lauf) Docker-frei absichern
- **Dateien:** NEU `src/lib/services/dashboard.test.ts`
- **Input:** injizierte Fake-Quellen (Erfolg/Fehler-Faelle) — **kein `vi.mock`** (Entscheidung Review: DI statt Modul-Mocking)
- **Output:** gruene Tests inkl. „eine Quelle wirft → uebrige Daten intakt, ERR-Flag gesetzt, Sentry-Hook aufgerufen"

> **3x3-Block:** Nach Schritt 1.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] `getAllModelProfiles` exportiert
- [ ] `src/lib/services/dashboard.ts` mit `getDashboardSummary` + Types
- [ ] Unit-Tests gruen (`npm run test`)

### Checkpoint-Kriterien

- [ ] Kennzahlen decken alle Register-Zeilen der Spec ab (Modelle profiliert/unprofiliert, Personas, letzter Lauf vor N Stunden, Typ + Stabilitaet je Modell)
- [ ] Ausfall EINER Quelle laesst die uebrigen Werte intakt (Test belegt es); Sentry-Event je Ausfall
- [ ] Keine Per-Modell-Einzelabfragen; Runs-Kennzahl ohne Volllast (Count-Query)

---

## Phase 2: Register — server-gerenderte Kennzahl-Zeilen

### Ziel

Die 3 statischen Kacheln werden ein „Register" mit echten Kennzahlen, Links,
Hover-Muster und definierten 0-/ERR-Zustaenden — komplett server-gerendert.

### Schritte

#### Schritt 2.1: Dashboard-Seite auf Summary umstellen + Register-Grundgeruest

- **Zweck:** Datengetriebene Zeilen (CHRONARIUM-Register-Muster) statt leerer Kacheln
- **Dateien:** `src/pages/dashboard.astro`; klein: Helper fuer relative Zeitangabe („vor N Stunden") nach `src/lib/` (mit Unit-Test)
- **Input:** `getDashboardSummary` (Phase 1)
- **Output:** Zeilen/Karten Models/Personas/Runs mit Kennzahlen (Mono-Werte), Links (`/models`, `/personas`, `/runs`), Hover Border→primary wie bisher; 0-Werte sichtbar statt versteckt; ERR-Zustand je Zeile bei Quell-Ausfall

#### Schritt 2.2: Modell-Detailzeilen + Compare-Schnellzugriff

- **Zweck:** Je profiliertem Modell Typ + Stabilitaet zeigen und den Weg ins Profil/den Vergleich oeffnen
- **Dateien:** `src/pages/dashboard.astro`
- **Input:** Summary-Modelle, `modelProfileHref`
- **Output:** Zeile je profiliertem Modell (Name, Typ, Stabilitaet %, Link Profil); unprofilierte gedimmt ohne Typ; ab 2 Profilen Schnellzugriff `/models/compare`

#### Schritt 2.3: OEJTS-Attribution extrahieren + Sichtpruefung Light/Dark

- **Zweck:** Attributionspflicht (Spec-Kriterium), sobald Typen sichtbar sind; DRY bei 3. Verwendung (Entscheidung Review: Extraktion, im selben PR)
- **Dateien:** NEU `src/components/models/OejtsAttribution.tsx`; `ModelProfile.tsx` + `ModelComparison.tsx` mechanisch umgestellt; Einbindung in `dashboard.astro`
- **Input:** bestehendes Attribution-Markup (`ModelProfile.tsx:140`)
- **Output:** Attribution im Dashboard sichtbar, wenn ≥1 Typ gezeigt wird; Light/Dark lokal geprueft

> **3x3-Block:** Nach Schritt 2.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Register live (lokal) mit echten Kennzahlen, 0-/ERR-Zustaenden
- [ ] `OejtsAttribution`-Komponente, 3 Verwendungen

### Checkpoint-Kriterien

- [ ] Frischer Account: Register zeigt 0-Werte, kein Layout-Bruch
- [ ] Simulierter Quell-Ausfall zeigt ERR-Zeile, Rest funktioniert
- [ ] Nur semantische Tokens (kein Farb-Literal im Diff)

---

## Phase 3: Hero — server-gerendertes SVG mit CSS-Animation

### Ziel

Ein ruhig animiertes Hero-Element (SVG, server-gerendert, Animation rein per
CSS) zeigt die profilierten Modelle als lebende Darstellung — mit Leerzustand
als Einladung und Stillstand unter `prefers-reduced-motion` (CSS-Media-Query).

### Schritte

#### Schritt 3.1: Skizzen-Runde — Metapher festziehen

- **Zweck:** Design-Entscheidung (Orbits/Feld/Konstellation) VOR der Umsetzung, per Sichtung statt Diskussion (Entscheidung Review: Skizzen vor Phase 3, kein Leerlauf in der Session)
- **Dateien:** Wegwerf-Skizzen (Scratch, nicht committen); Ergebnis in der Entscheidungstabelle dieses Plans
- **Input:** 2–3 statische SVG-Varianten mit realistischen Beispieldaten (Damians Prod-Stand: 4 Modelle)
- **Output:** Entschiedene Metapher, dokumentiert in `## Technische Entscheidungen`

#### Schritt 3.2: Layout-Logik + statisches Hero (server-gerendert)

- **Zweck:** Positionen/Skalierung/Auswahl als pure Funktionen (unit-testbar); Hero mit fester Hoehe — kein Springen
- **Dateien:** NEU `src/components/dashboard/DashboardHero.astro` (server-gerendertes SVG, feste Hoehe), NEU `src/components/dashboard/hero-layout.ts` (pure: Positionen/Skalierung/Auswahl)
- **Input:** Summary-Modelle (Name, Typ, Stabilitaet, usableReps, lastRunAt); entschiedene Metapher aus 3.1
- **Output:** Statisches Hero in `dashboard.astro` eingebunden; Farben via `var(--chart-1)`/`var(--chart-2)`/`currentColor` (Light/Dark automatisch); Modell-Elemente verlinken auf `modelProfileHref`

#### Schritt 3.3: CSS-Animation + Bewegungsreduktion

- **Zweck:** „Ruhig und konstant" (HELIOS-Prinzip) statt Effekt-Feuerwerk; Barrierefreiheit ohne JS
- **Dateien:** `DashboardHero.astro` (scoped styles) bzw. `src/styles/global.css` (falls Keyframes global sinnvoll)
- **Input:** statisches Hero aus 3.2
- **Output:** Dezente Puls-/Orbit-Bewegung per CSS-Keyframes; `@media (prefers-reduced-motion: reduce)` → Animation aus, Inhalt identisch; Browser pausiert bei verborgenem Tab selbst

> **3x3-Block:** Nach Schritt 3.3 → Zusammenfassung + Feedback einholen

#### Schritt 3.4: Hero-Zustaende + Unit-Tests + Wiederverwendbarkeits-Notiz

- **Zweck:** Randfaelle der Spec abbilden; Logik absichern; Kapselung fuer Idee #5 dokumentieren (Review-Befund: Doku-Versprechen braucht liefernden Schritt)
- **Dateien:** `DashboardHero.astro`, `hero-layout.ts`, NEU `src/components/dashboard/hero-layout.test.ts`, Doku-Kommentar im Modulkopf von `hero-layout.ts`
- **Input:** Summary mit 0 / teils / > 8 Modellen
- **Output:** Leerzustand = angedeutete unbelegte Struktur + „Profile your first model → Runs"; unprofilierte gedimmt ohne Typ; > 8 → die 8 zuletzt aktiven (`lastRunAt`) + „+N more"-Hinweis, kein Scrollen. Tests: Auswahl bei > 8, Dimm-Logik, Leerzustand. Modulkopf dokumentiert die fuer Idee #5 wiederverwendbaren Muster (pure Layout-Funktionen, Token-Nutzung via `var(…)`, reduced-motion per CSS)

> **3x3-Block:** Nach Schritt 3.4 (Phasen-Ende) → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] Hero live (lokal) in allen 4 Zustaenden (voll/teil/leer/>8)
- [ ] `prefers-reduced-motion` verifiziert (DevTools-Emulation)
- [ ] Unit-Tests gruen

### Checkpoint-Kriterien

- [ ] Keine neuen Dependencies im Diff (`package.json` unveraendert); keine neue Insel (Hero bleibt server-gerendert)
- [ ] Werte/Inhalte identisch mit und ohne Bewegung
- [ ] Wiederverwendbarkeit fuer Idee #5 im Modulkopf von `hero-layout.ts` dokumentiert (Schritt 3.4)

---

## Phase 4: Absicherung + Abnahme

### Ziel

Kette browser-seitig absichern, ueber den PR-Weg (Verdict-Gate) ausliefern,
in Prod sichtpruefen.

### Schritte

#### Schritt 4.1: E2E-Test der Dashboard-Kette (via `/10x-e2e`)

- **Zweck:** Risiko-Grenzen absichern: Auth/RLS + Summary-Aggregation + Verlinkung (Schichten einzeln getestet, Zusammenspiel nicht)
- **Dateien:** NEU `tests/e2e/dashboard.spec.ts` (Seeding-Muster `tests/e2e/support/seed.ts`)
- **Input:** geseedete Baseline-Laeufe (wie `model-compare.spec.ts`); Hero ist server-gerendert — kein Insel-Hydration-Wait noetig
- **Output:** EIN Test: Login → Dashboard zeigt geseedete Kennzahlen (Modell mit Typ, Personas-/Runs-Werte) → Klick Modell-Link → Profil-Seite; inkl. Gegenprobe (Pflicht aus `/10x-e2e`)

#### Schritt 4.2: Full Suite + PR

- **Zweck:** Verdict-Gate greift (Champion-Beleg); kein Admin-Bypass fuer Code
- **Dateien:** —
- **Input:** Phasen 1–3 committet auf Feature-Branch
- **Output:** `npm run test` + `npm run lint` + `npm run build` gruen; PR mit gruenem `ai-review/verdict` + `ci` + `integration`; Squash-Merge (danach `git reset --hard origin/main`)

#### Schritt 4.3: Prod-Sichtpruefung + Abnahme

- **Zweck:** Sichtbare Qualitaet nur menschlich pruefbar (Spec-Kriterien)
- **Dateien:** `plan.md` (Progress), danach `/dtb:workflow-checkpoint`
- **Input:** Deploy nach Merge
- **Output:** Sichtpruefung durch Damian: Light + Dark, reduced-motion, Kennzahlen plausibel, Attribution sichtbar; Feature → Abnahme (`/dtb:archive` spaeter)

> **3x3-Block:** Nach Schritt 4.3 → Zusammenfassung + Feedback einholen

### Deliverables

- [ ] E2E gruen (lokal, Docker + Supabase)
- [ ] PR gemergt, Deploy gruen
- [ ] Prod-Sichtpruefung bestanden

### Checkpoint-Kriterien

- [ ] Alle Success Criteria der Spec abgehakt
- [ ] Verdict-Gate-Beleg vorhanden (PR-Nummer)

---

## Technische Entscheidungen

| Thema                     | Optionen                                                                                                                 | Entscheidung                                     | Begruendung                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero-Technik              | A: Canvas 2D (Discovery-Idee); B: SVG + CSS-Animation                                                                    | B (Review 2026-07-15)                            | Tokens direkt via `var(…)`/`currentColor`, reduced-motion als CSS-Media-Query, kein Theme-Observer/DPR/Hydration; HELIOS nutzt selbst ueberwiegend SVG. Canvas lohnt erst bei vielen bewegten Objekten                                      |
| Hero-Rendering            | A: React-Insel (`client:visible`); B: server-gerendertes `.astro` + CSS                                                  | B (folgt aus SVG+CSS)                            | CSS-Animation braucht kein JS → keine Insel, kein Layout-Sprung; Spec-Kriterium „nichts springt nach" per Konstruktion erfuellt; feste Hero-Hoehe zusaetzlich                                                                               |
| Zugriff auf volle Profile | A: `getAllModelProfiles`-Export in `model-profiles.ts`; B: `getModelProfiles` mit allen Config-Namen fuettern            | A                                                | 3-Zeilen-Wrapper um bestehendes `loadProfiles`, kein Eingriff in die Kapselung. **Bewusst akzeptiert:** `loadProfiles` laedt Configs intern selbst → eine doppelte (parallele, kleine) configs-Query pro Dashboard-Load (Review 2026-07-15) |
| Teilausfall-Strategie     | A: fail-fast (eine Quelle wirft → 500); B: `Promise.allSettled` je Quelle + ERR-Flag                                     | B                                                | Spec-Randfall „Fehlerfaelle": Rest rendert trotzdem; deckt sich mit CHRONARIUM-`ERR`-Muster. **Plus Sentry-Event je catch-Pfad** (Review 2026-07-15) — sichtbarer Day-2-Betrieb                                                             |
| Runs-Kennzahl-Beschaffung | A: `listRuns` (laedt alle sichtbaren Zeilen); B: Count-Query (`count: "exact", head: true`) + juengster Lauf (`limit 1`) | B (Review 2026-07-15)                            | Konstant billig; waechst nicht mit fremden globalen Laeufen. Scope bleibt „sichtbare Laeufe" (eigene + globale) — dieselbe Menge wie die verlinkte `/runs`-Seite                                                                            |
| Attribution-Markup        | A: 3. Kopie in `dashboard.astro`; B: gemeinsame Komponente `OejtsAttribution.tsx`, Bestand umstellen                     | B (Review 2026-07-15)                            | 3. Verwendung rechtfertigt DRY; Umstellung mechanisch, im selben PR wie Phase 2 (eine Review-Einheit)                                                                                                                                       |
| Test-Strategie Summary    | A: `vi.mock` je Quell-Modul; B: reiner Kern + injizierte Quellen (Muster `buildModelProfiles`)                           | B (Review 2026-07-15)                            | Pur testbar ohne Modul-Mocking; fragile Import-Mocks vermieden                                                                                                                                                                              |
| Hero-Metapher             | Orbits / Feld / Konstellation                                                                                            | **Orbit** (Skizzen-Runde 3.1, Damian 2026-07-15) | 3 SVG-Skizzen mit echten Prod-Daten gesichtet; Orbit = Modelle als Trabanten um den Baseline-Kern (fachlich passend: alles misst gegen die Baseline); Ring = Aktualitaet, Punktgroesse = Reps                                               |
| > 8 profilierte Modelle   | A: skalieren; B: 8 zuletzt aktive (`lastRunAt`) + „+N more"                                                              | B                                                | `lastRunAt` liegt in `meta` bereits vor; Skalieren macht Beschriftung unlesbar (Spec: keine Scrollbalken)                                                                                                                                   |

---

## Progress

> Single Source of Truth fuer den Umsetzungsstand (Regeln: `project-rules/DERIVED_STATE_RULES.md`).
> Nach jedem umgesetzten Schritt sofort abhaken; Commit-SHA als Beleg (optional bei Schritten ohne Commit).

- [x] 1.1 `getAllModelProfiles`-Export — `407f7d1`
- [x] 1.2 `getDashboardSummary` (reiner Kern + DI, Count-Query, Sentry) — `407f7d1`
- [x] 1.3 Unit-Tests Summary-Service — `407f7d1`
- [x] 2.1 Register-Grundgeruest in `dashboard.astro` — `b19e903`
- [x] 2.2 Modell-Detailzeilen + Compare-Schnellzugriff — `b19e903`
- [x] 2.3 `OejtsAttribution`-Extraktion + Light/Dark-Sichtpruefung — `b19e903`; Sichtpruefung durch Damian bestanden; Hero-Motion sichtbar nachkalibriert `c0b9be3`
- [x] 3.1 Skizzen-Runde — Metapher festziehen (Orbit) — `1c6a470`
- [x] 3.2 `hero-layout.ts` + statisches Hero (server-gerendert, feste Hoehe) — `1c6a470`
- [x] 3.3 CSS-Animation + Bewegungsreduktion — `1c6a470`
- [x] 3.4 Hero-Zustaende + Unit-Tests + Wiederverwendbarkeits-Notiz — `02a9811` (Zustaende + Notiz bereits in `1c6a470`)
- [x] 4.1 E2E Dashboard-Kette (Register-Aggregation + Profil-Routing, deliberate-break verifiziert) — `2ffdf80`
- [ ] 4.2 Full Suite + PR (Verdict-Gate)
- [ ] 4.3 Prod-Sichtpruefung + Abnahme

---

## 3x3 Umsetzungsrhythmus

Dieser Plan ist fuer die Umsetzung im **3x3-Rhythmus** ausgelegt:

1. Implementiere max. 3 Schritte aus dem Plan
2. Hake die erledigten Schritte in `## Progress` ab (Commit-SHA als Beleg)
3. Fasse kurz zusammen was erledigt wurde
4. Beschreibe die naechsten 3 Schritte
5. **Stoppe und warte auf Feedback** bevor du weiterarbeitest

Bei Kontextverlust oder nach >6 Schritten: Die `## Progress`-Sektion ist der Wiedereinstiegspunkt —
in neuer Konversation `features/dashboard-mission-control/plan.md` laden; der erste nicht abgehakte
Schritt ist der naechste. Erkenntnisse/Abweichungen gehoeren in den Session-Log
(`/dtb:workflow-checkpoint`).

---

**Erstellt mit:** `/dtb:impl-plan` · **Reviewed:** `/dtb:plan-review` 2026-07-15 (REVISE → Anpassungen eingearbeitet)
