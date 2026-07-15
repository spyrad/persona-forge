# Discovery: Dashboard Mission Control

<!-- resume: done -->

**Erstellt:** 2026-07-14
**Idee-Referenz:** Inbox #4 — "Dashboard grafisch aufwerten (visueller Effekt)"
**Status:** Abgeschlossen

> Analyse-Grundlage: fable-25.netlify.app (105 Demos; im Detail analysiert:
> /helios/, /chronarium/, /gridwatch/ — Session 2026-07-14).

---

## Betroffene Module

| Pfad                                     | Beschreibung                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/pages/dashboard.astro`              | Kern — heute 3 statische Link-Kacheln ohne Daten, komplett server-gerendert             |
| `src/lib/services/model-profiles.ts`     | `listModelProfiles` liefert die profilierten Modelle — Datenquelle fuer Hero + Register |
| `src/lib/services/runs.ts`               | Lauf-Daten (Anzahl, letzte Laeufe) — Aktivitaets-Kennzahlen                             |
| `src/lib/services/personas.ts`           | Persona-Katalog — Kennzahl im Register                                                  |
| `src/lib/services/model-configs.ts`      | Konfigurierte Modelle (auch unprofilierte)                                              |
| `src/components/models/ModelProfile.tsx` | Bestehende Profil-Darstellung — Wiederverwendungs-Kandidat                              |
| `src/styles/global.css`                  | Design-Tokens; Animationen/Effekte docken hier an (keine Farb-Literale)                 |
| `src/layouts/AppLayout.astro`            | Rahmen (eyebrow/heading/lead) — falls das Dashboard ein anderes Format braucht          |

Extern (Inspiration, analysiert): HELIOS (`/helios/` — 1× Canvas 2D + 5 SVG-Sparklines, KEINE Library,
prefers-reduced-motion respektiert), CHRONARIUM (`/chronarium/` — "Register"-Muster: editoriale Liste
mit live tickenden Mono-Messwerten inkl. Fehlzustand `ERR`), GRIDWATCH (`/gridwatch/` — Header-Ticker
uebernehmbar; Three.js/WebGL-Unterbau bewusst NICHT uebernommen).

---

## Anforderungen

### Scope

**Enthalten:**

- Dashboard wird ein datengetriebenes "Mission Control" im Stil HELIOS/Chronarium
- Zentrales, ruhig animiertes Hero-Element (Canvas 2D): die profilierten Modelle als lebende Darstellung
- "Register" darunter: die bisherigen 3 Kacheln (Models/Personas/Runs) werden Zeilen/Karten mit echten
  Kennzahlen (X Modelle profiliert, Y Personas, letzter Lauf vor N Stunden, Typ + Stabilitaet je Modell)
- Design-Token-konform (semantische Tokens, Teal/Amber-Akzente), Light + Dark

**Nicht enthalten:**

- KEIN Three.js/WebGL, keine 3D-Rotation (Erkenntnis der Analyse: Lebendigkeit kommt aus echten,
  sich bewegenden Daten, nicht aus 3D)
- KEIN Echtzeit-Polling — SSR-Snapshot beim Laden genuegt
- KEINE Live-Run-Ansicht (bleibt Idee #5)
- KEIN Umbau anderer Seiten

### Gewuenschtes Verhalten

- Beim Oeffnen beantwortet das Dashboard auf einen Blick "Was ist der Stand meines Labors?" —
  Hero zeigt die profilierten Modelle (ruhig pulsierende Punkte/Orbits mit Modellname + Typ),
  Register darunter Kennzahlen mit Links in die Bereiche; Werte beim Laden da (SSR), nichts springt nach
- Bewegung dezent und konstant (Chronarium-Stil: tickende Werte, langsame Bewegung) statt Effekt-Feuerwerk;
  unter `prefers-reduced-motion` steht alles still, Inhalte identisch
- Bestehende UX-Muster bleiben: editoriale Sprache (eyebrow "01 — overview", Serif-Headline, Mono-Labels),
  Hover-Verhalten der Kacheln (Border → primary) auf Register-Zeilen uebertragen, Badges/Fehlzustaende
  im Stil der Run-Liste

### Randfaelle

- **Leerer Zustand (frischer Account):** Hero als "Empty-State als Einladung" — angedeutete, unbelegte
  Orbit-Struktur + Call-to-Action ("Profile your first model → Runs"); Register zeigt Zeilen mit
  0-Werten statt sie zu verstecken
- **Teilbefuellt:** Modell konfiguriert, aber ohne Baseline-Laeufe → erscheint im Hero als "unprofiliert"
  (gedimmt, ohne Typ), analog zum baseline-Badge-Muster aus Model Compare
- **Fehlerfaelle:** schlaegt eine Service-Abfrage fehl, rendert der Rest trotzdem — betroffene Kachel
  zeigt ERR-Zustand im Chronarium-Stil statt Seiten-Crash
- **Grenzwerte:** > 8 profilierte Modelle → Hero skaliert oder zeigt die zuletzt aktiven; keine
  Scrollbalken im Hero
- **Geloeschte Personas (`persona_id null`):** Baseline-Erkennung strikt ueber `isBaselineRun`
  (Lektion L1), nie ueber Nullitaet

### Einschraenkungen

**Technisch:**

- **Edge-Runtime:** Dashboard ist geschuetzte SSR-Route — Kennzahlen aus wenigen, gebatchten Queries
  (model-profiles-Service arbeitet bereits so); kein N+1 ueber Modelle
- **Islands-Architektur:** Hero-Canvas als EINE React-Insel (`client:visible`, Lehre aus PR #8:
  nicht vorschnell `client:load`); Register bleibt server-gerendert
- **Design-System:** nur semantische Tokens (Serien: Teal `--chart-1`, Amber `--chart-2`), Light + Dark,
  keine Farb-Literale — auch nicht im Canvas (Tokens per `getComputedStyle` auslesen)
- **Keine neuen Dependencies:** Canvas 2D + SVG reichen (HELIOS-Beweis); `prefers-reduced-motion` Pflicht

**Fachlich:**

- **OEJTS-Attribution:** Sobald das Dashboard Typen (INFJ etc.) zeigt, gilt die CC-BY-NC-SA-Attributionspflicht
  auch dort — gleicher Hinweis wie auf Profil-/Compare-Seiten

### Integrationspunkte

- **Lesend genutzt, unveraendert:** `model-profiles` (`listModelProfiles`), `runs`, `personas`,
  `model-configs` — alle Abfragen ueber den RLS-gesicherten SSR-Client. Denkbar: neue Buendel-Funktion
  `getDashboardSummary` in `src/lib/services/` als EIN Service-Einstiegspunkt (testbar wie model-profiles)
- **Verlinkung ins Bestehende:** Hero-Modelle → `/models/profile?m=…`; Register-Zeilen → `/models`,
  `/personas`, `/runs`; bei ≥ 2 profilierten Modellen Schnellzugriff `/models/compare`
  (`modelProfileHref`-Helper aus Model Compare Phase 5 wiederverwenden)
- **Keine externen Abhaengigkeiten:** keine neuen APIs, Packages oder Migrationen — reine Lese-Sicht
- **Nicht beruehrt:** Auth/Middleware, Run-Flow, Instrumente, andere Seiten

---

## Abhaengigkeiten

- Keine Konflikte: einziger aktiver Change-Ordner; `FEATURE_MODEL_NAME_COMBOBOX.md` (Altbestand)
  und `archive/model-compare/` beruehren anderes Terrain
- Ueberschneidung Idee #5 (Live-Run-Visualisierung): bewusst abgegrenzt (Scope "Nicht enthalten");
  Idee #6 (Combobox): unabhaengig

---

## Offene Punkte

- Hero-Canvas so kapseln, dass Idee #5 (Live-Run-Visualisierung) die Muster wiederverwenden kann:
  Token-Auslesen per `getComputedStyle`, `prefers-reduced-motion`-Handling, Insel-Zuschnitt
- Konkrete Hero-Metapher (Orbits? Feld? Konstellation?) im Plan/Design entscheiden — Discovery legt
  nur fest: ruhig, datengetrieben, Canvas 2D
- Grenzwert-Verhalten bei > 8 profilierten Modellen (skalieren vs. "zuletzt aktive") im Plan festlegen

---

**Erstellt mit:** `/dtb:feature-discover`
