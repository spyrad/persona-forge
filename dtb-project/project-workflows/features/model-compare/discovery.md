# Discovery: Modell-zentrierte Ergebnisansicht (Model Compare)

<!-- resume: done -->

**Erstellt:** 2026-07-11
**Idee-Referenz:** Inbox #2 — „Modell-zentrierte Ergebnisansicht (Model Compare) — Runs/Testruns beziehen sich je auf ein distinctes Modell; Ergebnisse pro Modell aggregieren und vergleichbar darstellen statt run-für-run. Vorbild: OpenRouter-Compare, aber mit unseren Test-Ergebnissen; ausgelegt auf künftige Palette psychometrischer Tests."
**Status:** Abgeschlossen

---

## Betroffene Module

| Pfad                                                   | Beschreibung                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`                                         | `Run` (`modelConfigId`), `RunAggregate`, `RunResultView`, `RunComparisonView` — neue modell-zentrierte View-Struktur |
| `src/lib/services/runs.ts`                             | Run-Laden/Aggregation (RLS-gescoped); neue Abfrage „alle ready-Runs je Modell"                                       |
| `src/lib/services/model-configs.ts`                    | Modell-Konfigurationen — Einstiegspunkt der Gruppierung                                                              |
| `src/lib/runs/oejts-aggregate.ts`                      | Aggregation je Run — Basis für Aggregation über Runs hinweg                                                          |
| `src/lib/runs/steadfastness-aggregate.ts`              | dito für zweiten Test-Typ (`kind`-Diskriminator)                                                                     |
| `src/pages/runs/compare.astro`                         | Bestehender Run-vs-Run-Vergleich — Vorbild; bleibt in v1 unangetastet                                                |
| `src/components/runs/RunComparison.tsx`                | Vergleichs-Darstellung (2 Seiten) — Muster für N Modelle nebeneinander                                               |
| `src/components/runs/RunResult.tsx` + `axis-chart.tsx` | Achsen-Verteilungs-Darstellung — wiederverwendbar pro Modell-Spalte                                                  |
| `src/pages/models.astro`                               | Modell-Liste — Absprungpunkt („Ergebnisse dieses Modells")                                                           |
| `src/pages/runs.astro`                                 | Run-Liste mit Compare-Checkboxen — Navigation/Einstieg ggf.                                                          |
| `src/pages/dashboard.astro`                            | Kandidat für modell-zentrierte Kacheln                                                                               |
| `supabase/migrations/`                                 | Nur falls Aggregation per SQL-View/RPC statt App-Code                                                                |
| Neu: `src/pages/models/[...]`-Seite(n)                 | Modell-Profil + Modell-vs-Modell-Vergleich (das neue Artefakt)                                                       |

**Scan-Befund:** Runs referenzieren `model_configs` (User-Config mit Label/Provider), nicht ein kanonisches Modell — mehrere Configs können dasselbe `modelName` tragen. → Entscheidung siehe Scope.

---

## Anforderungen

### Scope (3a)

**Enthalten:**

- Modell-zentrierte Ansicht: pro Modell alle zugehörigen Test-Ergebnisse aggregiert (über alle Runs des Modells, je Instrument)
- Modell-vs-Modell-Vergleich nebeneinander (OpenRouter-Vorbild)
- Instrument-agnostische Anlage (künftige Tests aus Inbox #3 docken ohne Umbau an)
- **Gruppierung nach `modelName`** — alle Model-Configs mit demselben Modellnamen werden zusammengefasst (nicht nach `model_configs.id`)

**Nicht enthalten:**

- Kein Persona-Vergleich in v1 (Persona-Dimension der „Mappe" kommt später, vgl. Inbox #3)
- Bestehender Run-vs-Run-Compare (`/runs/compare`) bleibt in v1 unangetastet (kein Abriss, keine Änderung)

### Gewuenschtes Verhalten (3b)

- **Einstieg über die Modell-Liste** (`/models`): von dort ins Modell-Profil bzw. in den Vergleich
- **N Modelle nebeneinander: 2–4** (nicht auf 2 begrenzt)
- **Mit Meta-Infos** je Modell-Spalte: Anzahl Runs/Reps, Zeitraum, verwendete Configs — nicht nur die Achsen-Verteilungen
- **Bestehende UX-Muster übernehmen:** `axis-chart` + Mono-Eyebrow-Panel-Header aus `RunResult`/`RunComparison` (editorial Design-Sprache der Anzeige-Flächen), Auswahl-Muster analog Run-Liste (Checkboxen)

### Randfaelle (3c)

_User-Entscheidung: „sinnvolle Defaults" — konkret vereinbart:_

- **Fehler beim Laden:** erklärender Zustand statt 500 (bestehendes Muster aus `compare.astro`)
- **Modell ohne ready-Runs:** nicht wählbar (taucht in der Auswahl nicht als vergleichbar auf)
- **Instrument ohne Daten:** Empty-State je Instrument-Sektion („no data"), Spalte bleibt sichtbar
- **Nur 1 Modell mit Daten:** Compare unmöglich → nur Profil-Ansicht; Hinweis statt leerer Vergleich
- **Dünne Datenlage:** Hinweis ab < 5 usable Reps je Modell+Instrument (statistisch dünn)
- **Gelöschte Model-Config mit verbleibenden Runs:** Runs ohne auflösbaren `modelName` werden von der Gruppierung ausgeschlossen
- **Gleicher `modelName` über verschiedene Provider/Endpoints:** als EIN Modell zusammenfassen; Provider-Streuung als Hinweis in den Meta-Infos

### Einschraenkungen (3d)

- **Aggregation im App-Code (v1):** bestehende TS-Aggregat-Funktionen wiederverwenden, keine SQL-View/RPC. Interface = Service-Funktion in `runs.ts`, damit ein späterer Umstieg auf DB-Aggregation billig bleibt (Optimierung, falls Profile träge werden).
- **OEJTS-Attribution (CC BY-NC-SA):** Die neue Ansicht zeigt OEJTS-Ergebnisse → Attributions-Hinweis wie in `RunResult` erforderlich; als explizites Abnahme-Kriterium in den Plan (darf durch neue Panel-Struktur nicht herausfallen).
- **Mindest-Datenlage: weiche Variante** — Profil immer zeigen + Dünn-Daten-Hinweis (< 5 usable Reps je Modell+Instrument, s. 3c). Kein hartes Gate; Neubewertung erst falls öffentliche/geteilte Profile kommen (nicht v1).
- **Aggregations-Schlüssel: `(modelName, Instrument)`** — pro Modell und Test-Typ alle usable Reps aus allen ready-Runs zu einer Verteilung je Achse; das Modell-Profil ist die Sammlung dieser Instrument-Aggregate („Mappe").
- **Nur Runs ohne Persona (`personaId = null`) fließen ins Modell-Profil** — Persona-Runs würden das Basis-Profil verfälschen. Meta-Info weist Ausschluss aus (z.B. „12 runs aggregated, 4 persona runs excluded"). Persona-Dimension kommt später als eigene Vergleichsebene.
- Design-Konventionen gesetzt: semantische Tokens, `cn()`, React nur bei Interaktivität, editorial Design-Sprache der Anzeige-Flächen.

### Integrationspunkte (3e)

- **`models.astro`:** bekommt den Einstieg (Modell-Profil-Link / Compare-Auswahl) — Kern-Integrationspunkt
- **Dashboard: explizit raushalten** — keine modell-zentrierten Kacheln in v1; der Gedanke wandert in Inbox #4 (Dashboard-Visualisierung), damit sich die Vorhaben nicht überlappen
- **Run-Liste (`runs.astro`): nur Querverlinkung** („view model profile"), sonst unangetastet
- **Keine externen Abhängigkeiten:** nur eigene Supabase-Daten; keine neuen APIs, keine LLM-Calls, keine OpenRouter-Metadaten

---

## Abhaengigkeiten

- Keine bestehenden Feature-Ordner mit spec/plan — keine Konflikte.
- Inhaltliche Berührungen (abgegrenzt): Inbox #3 (Test-Palette) als künftiger Datenlieferant → Instrument-agnostische Anlage; Inbox #4 (Dashboard) erhält die modell-zentrierten Kacheln, hier bewusst ausgeklammert.

---

## Offene Punkte

- Zukunft des Run-vs-Run-Compares unklar: möglicherweise ergibt Einzellauf-Vergleich langfristig wenig Sinn; Entscheidung (behalten/abreißen) bewusst vertagt, bis Model-Compare live ist.
- **Zukunfts-Analyse Persona×Modell-Interaktion (nicht v1):** Welches Modell setzt eine gegebene Persona am effektivsten/treuesten um (Persona-Fidelity)? Hypothese: Modelle reagieren unterschiedlich stark auf Persona-Eigenschaften. Braucht das saubere Basis-Profil (v1) als Referenzpunkt; verknüpft mit Inbox #1 (Task-based evals) und #3 (Test-Palette/Persona-Verschiebung).
- Modell-Namens-Normalisierung (z.B. `gpt-5.5` vs. `openai/gpt-5.5` je nach Provider) — klären, ob Normalisierung nötig ist oder exakter String-Match reicht.

---

**Erstellt mit:** `/dtb:feature-discover`
