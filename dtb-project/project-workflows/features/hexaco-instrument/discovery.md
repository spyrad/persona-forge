# Discovery: HEXACO-Instrument

<!-- resume: done -->

**Erstellt:** 2026-07-16
**Idee-Referenz:** Inbox #3 — "Palette weiterer psychometrischer Tests"
**Status:** Abgeschlossen

---

## Betroffene Module

| Pfad                                                                  | Beschreibung                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/services/runs.ts`                                            | **Zentraler Enabler** — hartkodierte `OEJTS`-Referenz durch Instrument-Registry (`instrument_id → Instrument`) ersetzen                    |
| `src/lib/instruments/hexaco.ts`                                       | NEU — Instrument-Definition analog `oejts.ts` (6 Faktoren H/E/X/A/C/O, IPIP-Items, Pol-Labels, `hasModalType: false`)                      |
| `supabase/migrations/…`                                               | NEU — `kind`-Check-Constraint erweitern bzw. `instrument_id` nutzen; Default `oejts` bleibt; RLS je Operation wie bestehende Runs-Policies |
| `src/types.ts`                                                        | `Run.kind`- / `CreateRunInput`- / `ModelProfileSection`-Unions + optionaler Modaltyp am `Instrument`                                       |
| `src/pages/api/runs/create-schema.ts`                                 | zod-Discriminated-Union um HEXACO-`kind`/`instrumentId` erweitern                                                                          |
| `src/components/runs/RunRunner.tsx`                                   | Instrument-Selector-Option + `instrumentId` variabel statt hartkodiert `"oejts-1.2"`                                                       |
| `src/components/runs/RunResult.tsx`                                   | Ergebnis-Anzeige: 6 Faktor-Verteilungen; Typ-Block bei `hasModalType: false` auslassen                                                     |
| `src/lib/services/model-profiles.ts`                                  | Neue Instrument-Sektion (wie Steadfastness), Baseline-Filter je `kind`                                                                     |
| `src/components/models/OejtsAttribution.tsx`                          | → generischer `InstrumentAttribution` (Metadaten je Instrument: Autor/Quelle/Lizenz-Label/Link)                                            |
| `src/components/landing/TestLibrary.astro`                            | „Big Five/HEXACO" von `planned` → `live`                                                                                                   |
| `src/lib/runs/oejts-score.ts`, `oejts-aggregate.ts`, `axis-chart.tsx` | Nahezu unberührt — Kern ist bereits achsen-agnostisch (6 Achsen skalieren durch)                                                           |

---

## Anforderungen

### Scope

**Enthalten:**

- Ein neues item-basiertes Instrument **HEXACO** (6 Faktoren H/E/X/A/C/O, **Faktor-Ebene**), messbar im bestehenden Lauf-Fluss (Modell, Persona, N Wiederholungen 1–25).
- **Item-Quelle: gemeinfreie IPIP-Items** (public domain), die die HEXACO-Faktoren inkl. Honesty-Humility abbilden — NICHT die © HEXACO-PI-R-Original-Items.
- **Enabler:** Generalisierung des hartkodierten OEJTS-Pfads in `runs.ts` zu einer Instrument-Registry (`instrument_id → Instrument`).
- Ergebnis als Achsen-Verteilungen (6 statt 4); Einbindung in Model-Profile, Compare, Dashboard als eigene Instrument-Sektion.
- **Parametrisierte Attribution** (Metadaten am Instrument), ersetzt den statischen OEJTS-Block.
- Optionaler Modaltyp: `deriveType` nur wenn `hasModalType: true` — HEXACO ohne Typ-Code.

**Nicht enthalten:**

- Short Dark Triad (SD3) → **Inbox #8** (direktes Folge-Feature, Registry dann geschenkt).
- Facetten-Tiefe / HEXACO-100 (25 Facetten) → **Inbox #9**.
- Die übrigen 6 Instrument-Kandidaten der Idee #3 (RWA/SDO, Schwartz-PVQ, BIS-BAS, Rosenberg, NfC, IPIP-NEO-Facetten).
- Keine neue Instrument-_Kategorie_ (kein Multi-Turn-Dialog wie Steadfastness).
- Kein variabler Likert-Breiten-Umbau (IPIP-HEXACO kommt mit der bestehenden 1–5-Skala aus).

### Gewuenschtes Verhalten

- **Reiner OEJTS-Zwilling im Fluss:** kein neues Bedienkonzept, HEXACO erscheint als weitere Option im Instrument-Selector; gleiche Lauf-Konfiguration und Ergebnis-Charts.
- **Attribution parametrisiert:** ein `InstrumentAttribution`-Baustein, Daten je Instrument (zahlt auf #8/#9 ein). Lizenz-**Label** je Instrument, kein pauschaler CC-Text.
- **Darstellung:** 6 Faktor-Verteilungen (Mean/SD/Verteilung je Faktor), **kein** Typ-Kürzel (fachlich korrekt für HEXACO); Faktoren bipolar mit Low/High-Pol-Labels aus HEXACO-Standardliteratur; Charts skalieren ohne Layout-Umbau auf 6 Achsen.

### Randfaelle

- **Unbekanntes `instrument_id`:** harter, geloggter Fehler (`[runs:instrument] unknown instrument_id=…`, via Sentry), KEIN stiller Fallback auf OEJTS.
- **Optionaler Typ-Code:** `RunResult`/Model-Profile/Compare lassen den Typ-Block bei `hasModalType: false` aus (kein leerer Kasten, kein „undefined", kein Crash).
- **Bestehende OEJTS-Läufe:** Migration erweitert nur den Constraint; Default `kind='oejts'` / `instrument_id='oejts-1.2'` bleibt; alte Läufe rendern unverändert. Baseline nur über `isBaselineRun`; Model-Profile-Sektionierung je `kind` (OEJTS-Sektion darf nicht verschoben werden).
- **Geerbt vom OEJTS-Pfad (unverändert):** Antwort-Parsing JSON + Freitext-Fallback (jetzt 60 Items), unvollständige/kaputte Antwort, Timeout, leere Reps.

### Einschraenkungen

- **Technisch:** 60 Items × N — Lauf-Aufteilung unkritisch (ein `chatCompletion`-Call pro Wiederholung, client-getrieben via `processNextRepetition`); längerer Prompt = mehr Tokens/Rep + höhere Chance auf ausgelassene Items (→ Parsing-Randfall greift). Kein v1-Blocker, ggf. Folge-Tuning.
- **Fachlich/Lizenz (entscheidend):** persona-forge-Repo ist **öffentlich** + öffentlich deployt → jede Item-Distribution ist öffentliche Verbreitung. Deshalb **IPIP-Items (public domain)** statt © HEXACO-PI-R — erfüllt die Leitplanke strenger als OEJTS (CC-BY-NC-SA) und ohne Redistribution-Risiko. Namen-Weglassen schützt nur Marken, nicht das Copyright an Item-Texten → nicht tragfähig gewesen.

### Integrationspunkte

- **Bestehende Module:** siehe „Betroffene Module" (Registry-Enabler in `runs.ts` ist der zentrale Punkt).
- **Externe Abhängigkeiten:** keine neue — LLM über bestehenden `openai-compatible.ts`; IPIP-Items sind statische Daten (kein npm-Package, keine API, keine neue Supabase-Extension).

---

## Abhaengigkeiten

- **Keine offenen Konflikte:** `features/` ist leer (kein aktiver Change). Archivierte Features (model-compare, dashboard-mission-control) berühren dieselben Dateien, sind aber gemergt/live.
- **Zahlt vor auf:** Inbox #8 (SD3) und #9 (HEXACO-100) — beide werden durch den Registry-Umbau + die parametrisierte Attribution zu Mini-Features.

---

## Offene Punkte

- **Vor der Spec zu verifizieren:** konkrete IPIP-HEXACO-Item-Liste (Länge/Faktor-Zuordnung, ipip.ori.org) + exaktes Public-Domain-Label für die Attribution.
- **Scope-Entscheidung Registry:** Der Enabler-Umbau von `runs.ts` ist Teil dieses Features (nicht separat) — Umfang in der Spec/Plan schärfen (Registry-Design, Migrationsweg des `kind`-Constraints).

---

**Erstellt mit:** `/dtb:feature-discover`
