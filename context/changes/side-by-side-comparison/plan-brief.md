# Zwei Läufe nebeneinander vergleichen (S-08) — Plan Brief

> Full plan: `context/changes/side-by-side-comparison/plan.md`

## What & Why

Nutzer kann genau zwei abgeschlossene OEJTS-Läufe (zwei Modelle oder zwei Personas)
auswählen und sieht beide Verteilungen je Achse überlagert mit ihren Streuungen, Typen und
dem Mittelwert-Delta. Das ist der zweite Kern-Nutzen des Produkts (US-02/FR-017): nicht nur
eine Disposition messen, sondern zwei direkt gegeneinanderstellen — und der letzte geplante
MVP-Slice.

## Starting Point

S-05 hat bereits alles Schwere geliefert: `getRunResult` (RLS-gescopt, on-the-fly aggregiert)
und die Achsen-Visualisierung (`AxisChart`/`AxisCard` in `RunResult.tsx`). S-08 ist deshalb eine
reine Lese-/Darstellungs-Erweiterung — kein neues Datenmodell, keine Migration, keine neue API.

## Desired End State

In `/runs` zwei completed-Läufe markieren → `/runs/compare?a=&b=` zeigt beide Köpfe (Persona +
Modell + Datum + Typ), ein Typ-Vergleichs-Banner und je Achse einen überlagerten Chart mit beiden
Score-Serien, beiden Mittelwert-Markern und dem Delta. Edge-Cases (gleiche/fremde/ungültige/nicht-
verwertbare Läufe) zeigen erklärende Zustände statt 500/kaputter Vergleiche.

## Key Decisions Made

| Decision         | Choice                                            | Why (1 sentence)                                                  | Source |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| Auswahl-UX       | Vergleichs-Haken in der Lauf-Liste (max. 2)       | Nutzer pickt mit Kontext, kein Seitenwechsel                      | Plan   |
| Darstellung      | Pro Achse überlagert (beide Serien in 1 Chart)    | Macht das Delta direkt sichtbar, responsive-freundlich            | Plan   |
| Beschriftung     | Persona + Modell + Datum + Typ, Fallback bei null | Klar WAS verglichen wird, robust gegen FK-set-null                | Plan   |
| Vergleichbarkeit | Nur completed + `state==="ready"`                 | Garantiert echte Verteilungen je Seite                            | Plan   |
| Constraint       | Zwei beliebige _verschiedene_ Läufe               | Erlaubt auch Stabilitäts-Vergleich gleicher Konfig; simple Regel  | Plan   |
| Delta            | Typ-Vergleich + Mittelwert-Delta je Achse         | Beantwortet „worin unterscheiden sie sich" aus vorhandenen Werten | Plan   |
| URL              | Bookmarkbare `/runs/compare?a=&b=` (SSR, RLS)     | Teilbar, reload-fest, passt zum bestehenden SSR-Muster            | Plan   |

## Scope

**In scope:** Auswahl-Modus in `/runs`; SSR-Vergleichsseite mit Guards; Persona-/Modell-Label-
Auflösung; überlagerte Achsen-Darstellung mit Typ-Banner + Mittelwert-Delta; Extraktion der
Chart-Primitive für Wiederverwendung.

**Out of scope:** N-Wege-Vergleich; Persistenz/Speichern von Vergleichen; neue API-Route;
Export/Teilen-Button; volle Delta-Tabelle (SD/Buchstaben); Änderung an Aggregation/Scoring oder
der S-05-Einzelansicht.

## Architecture / Approach

Datenfluss in drei Phasen: (1) Liste erzeugt die Vergleichs-URL, (2) `compare.astro` lädt beide
Läufe parallel über `getRunResult`, validiert alle Edge-Cases und löst Labels auf, (3) neue
`RunComparison.tsx` rendert die Überlagerung. Die Chart-Primitive (`toPct`, Score-Säulen) wandern
aus `RunResult.tsx` in ein geteiltes Modul, das eine oder zwei Serien rendert — die Einzelansicht
behält ihr Verhalten.

## Phases at a Glance

| Phase                   | What it delivers                                      | Key risk                                           |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| 1. Auswahl in der Liste | Haken (max. 2) + „Vergleichen" → URL                  | Selektions-State in der Step-Orchestrierungs-Insel |
| 2. SSR-Seite + Guards   | `compare.astro` lädt/validiert beide, baut DTO        | Alle Edge-Cases sauber (404/erklärend, kein 500)   |
| 3. Überlagerung + Delta | `RunComparison.tsx` mit Typ-Banner + Mittelwert-Delta | Chart-Extraktion ohne Regress der Einzelansicht    |

**Prerequisites:** S-05 ✅ (geliefert). Zwei completed+ready Läufe zum Testen (ggf. zwei kurze
Läufe treiben).
**Estimated effort:** ~1 Session über 3 Phasen.

## Open Risks & Assumptions

- „verwertbar" ist in der Liste nicht billig prüfbar (kein `usableReps` in `RunView`) → Haken an
  `completed` gebunden, die `ready`-Garantie erzwingt die Seite. Bewusste Aufteilung.
- Label-Auflösung kann bei fremden/gelöschten Personas scheitern → definierte Fallbacks.
- Kein Test-Runner eingerichtet → Verifikation über Dev-Server-Treibung + `astro check`/Build (wie S-05/S-07).

## Success Criteria (Summary)

- Nutzer wählt zwei abgeschlossene Läufe und sieht beide Verteilungen je Achse überlagert mit Streuung.
- Typ-Vergleich und Mittelwert-Delta je Achse stimmen mit den Einzelansichten überein.
- Ungültige/gleiche/fremde/nicht-verwertbare Auswahlen führen zu erklärenden Zuständen, nie zu 500.
