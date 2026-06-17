---
project: "persona-forge"
version: 1
status: draft
created: 2026-06-11
updated: 2026-06-17
prd_version: 1
main_goal: learn
top_blocker: time
---

# Roadmap: persona-forge

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

LLM-Disposition (wie zustimmend, vorsichtig, kreativ ein Modell antwortet) ist heute
eine Blackbox. persona-forge macht sie messbar: gemeinfreie psychometrische Instrumente
(v1: OEJTS) werden vielfach unter isolierten Bedingungen gegen eine Modell-/Persona-
Kombination gefahren; das Ergebnis ist je Achse eine **Verteilung mit Streuung** statt
eines Einzel-Punktwerts, plus der abgeleitete 4-Buchstaben-Typ. Zwei Konfigurationen
lassen sich direkt vergleichen.

## North star

**S-05: Nutzer sieht das Ergebnis eines Messlaufs als Verteilung je Achse plus Typ-Stabilität** — der kleinste End-to-End-Durchstich, der die Kernhypothese des Produkts (Verteilung statt Punktwert macht LLM-Disposition messbar) beweist; alles andere zahlt nur ein, wenn das funktioniert.

> „North star" (Leitstern) meint hier: der kleinste End-to-End-Slice, dessen erfolgreiche
> Auslieferung die Kern-Produkthypothese belegt — so früh sequenziert, wie seine
> Prerequisites es erlauben.

## At a glance

| ID   | Change ID                | Outcome (user can …)                                                        | Prerequisites | PRD refs                                  | Status   |
| ---- | ------------------------ | --------------------------------------------------------------------------- | ------------- | ----------------------------------------- | -------- |
| F-01 | connect-supabase         | (foundation) Supabase-Projekt verbunden; Datenzugriffs-Grundgerüst steht     | —             | FR-001, §Access Control                   | done     |
| F-02 | deploy-skeleton-live     | (foundation) Auto-Deploy auf main liefert eine Live-URL                      | —             | tech-stack.md (cloudflare-workers, CI)    | done     |
| S-01 | email-auth-live          | sich registrieren, anmelden und geschützte Seiten erreichen                  | F-01          | FR-001, §Access Control                   | done |
| S-02 | model-config-management  | ein OpenAI-kompatibles Modell anhängen und als Konfig speichern (Key verschlüsselt) | S-01    | FR-005, FR-006, NFR Key-Dichtheit         | done |
| S-03 | persona-catalog          | eine Persona anlegen (frei/strukturiert), im Katalog finden und kopieren     | S-01          | FR-007, FR-008                            | done |
| S-04 | oejts-measurement-run    | einen OEJTS-Lauf mit N Wiederholungen starten und Fortschritt sehen          | S-02, S-03    | US-01, FR-010, FR-012, FR-013, NFR Resilienz/Last/Fortschritt | blocked  |
| S-05 | distribution-results     | das Ergebnis je Achse als Verteilung mit Streuung plus Typ-Stabilität sehen  | S-04          | US-01, FR-016, NFR Reproduzierbarkeit     | proposed |
| S-06 | run-control-and-tokens   | einen laufenden Test abbrechen und den Token-Verbrauch je Lauf sehen         | S-04          | FR-014, FR-015                            | proposed |
| S-07 | visibility-controls      | Sichtbarkeit (privat/global) eigener Personas und Ergebnisse setzen          | S-03, S-05    | FR-003, §Access Control                   | proposed |
| S-08 | side-by-side-comparison  | zwei abgeschlossene Läufe nebeneinander vergleichen                          | S-05          | US-02, FR-017                             | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                      | Chain                              | Note                                                                  |
| ------ | -------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| A      | Zugang & Bausteine         | `F-01` → `S-01` → `S-02` / `S-03`  | Konto, Modellkonfig und Persona — die drei Eingaben des Leitsterns.    |
| B      | Methodenkern (Leitstern)   | `S-04` → `S-05`, parallel `S-06`   | Joins Stream A nach `S-02`/`S-03`; hier sitzt der Lernwert (main_goal: learn). |
| C      | Teilen & Vergleichen       | `S-07` / `S-08`                    | Joins Stream B at `S-05`; abschließende Vergleichs-/Sichtbarkeits-Schicht. |
| D      | Deploy-Skeleton            | `F-02`                             | Standalone; schafft den Verifikationspfad „auf Produktion prüfen" für alle Slices. |

## Baseline

What's already in place in the codebase as of `2026-06-11` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 + Tailwind 4 (per tech-stack.md; `src/pages`, `src/components`)
- **Backend / API:** partial — Astro-API-Routen vorhanden, aber nur Auth (`src/pages/api/auth/`); keine Domänen-API
- **Data:** partial — Supabase-SDK + `supabase/config.toml` vorhanden, aber keine Migrationen, kein Schema, kein Projekt verbunden
- **Auth:** partial — E-Mail+Passwort-Flows gescaffoldet (Signin/Signup/Signout, Route-Schutz in `src/middleware.ts`), aber ohne verbundenes Supabase-Projekt nicht funktionsfähig
- **Deploy / infra:** partial — `wrangler.jsonc` + CI-Workflow vorhanden, aber CI triggert auf `master` statt `main`, Secrets fehlen, kein Cloudflare-Workers-Deployment konfiguriert
- **Observability:** absent — keine Logging-/Error-Tracking-Integration (bewusst: kein NFR verlangt sie; bleibt schlank)

## Foundations

### F-01: Supabase-Projekt anbinden

- **Outcome:** (foundation) Ein Supabase-Projekt ist angelegt und mit der App verbunden (`.env`); das Datenzugriffs-Grundgerüst (Nutzer sieht nur Eigenes + Globales, per Row Level Security) ist als Contract etabliert — nicht das fertige Schema, nur der minimale Anker, an den Slices ihre Tabellen hängen.
- **Change ID:** connect-supabase
- **PRD refs:** FR-001, §Access Control, Guardrail „kein Leck über Nutzergrenzen"
- **Unlocks:** S-01 (und transitiv alle weiteren Slices); reduziert das Risiko „RLS zu spät konfiguriert" aus tech-stack.md
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zuerst sequenziert, weil jeder Slice user-scoped persistiert; ohne den Zugriffs-Contract von Anfang an entstehen Auth-Lücken, die später teuer nachzurüsten sind.
- **Status:** done

### F-02: Deploy-Skeleton live

- **Outcome:** (foundation) Merge auf `main` deployt automatisch auf Cloudflare Workers; eine Live-URL existiert. Umfasst den CI-Fix (`master`→`main`), Repo-Secrets und die Workers-Verknüpfung — nicht mehr.
- **Change ID:** deploy-skeleton-live
- **PRD refs:** tech-stack.md (deployment_target: cloudflare-workers, ci_default_flow: auto-deploy-on-merge)
- **Unlocks:** den Verifikationspfad „jeder Slice ist auf Produktion prüfbar" für S-01–S-08; schließt zudem die offene Kurs-Anforderung „Live-Deployment" (Modul 1) ab
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Früh sequenziert (learn-Bias: Cloudflare ist unbekannte Technik); wartet man bis zum Schluss, kollidieren Edge-Runtime-Überraschungen mit fertigen Features statt mit einem leeren Skeleton.
- **Status:** done

## Slices

### S-01: E-Mail-Auth funktioniert end-to-end

- **Outcome:** Nutzer kann sich per E-Mail + Passwort registrieren, anmelden, abmelden und erreicht geschützte Seiten; Unangemeldete landen auf der Anmeldung.
- **Change ID:** email-auth-live
- **PRD refs:** FR-001, §Access Control
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Das Scaffold liefert die Flows schon — der Slice ist bewusst klein (verdrahten + verifizieren statt bauen) und damit ein risikoarmer Einstieg in den Stack.
- **Status:** done

### S-02: Modellkonfiguration anlegen und sicher speichern

- **Outcome:** Nutzer kann ein OpenAI-kompatibles Modell anhängen (Base-URL, API-Key, Modellname) und als wiederverwendbare Konfiguration speichern; der Key liegt verschlüsselt at rest und verlässt den Server nie Richtung Client.
- **Change ID:** model-config-management
- **PRD refs:** FR-005, FR-006, NFR Key-/Daten-Dichtheit
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:**
  - Verschlüsselungsmechanik (Supabase Vault vs. App-seitig) — Owner: team (`/10x-plan`-Research). Block: no.
- **Risk:** Die Guardrail „nie Klartext" ist must-have — hier tief investieren lohnt, weil jede spätere Lauf-Funktion den Key konsumiert.
- **Status:** done

### S-03: Persona-Katalog

- **Outcome:** Nutzer kann eine Persona anlegen (System-Prompt frei oder strukturiert nach Spec) mit Name, Beschreibung, Tags; sie im Katalog wiederfinden und für Läufe auswählen; Änderung erzeugt eine neue Kopie (Personas sind unveränderlich).
- **Change ID:** persona-catalog
- **PRD refs:** FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zwei Eingabewege (frei + strukturiert) sind bewusst beide v1-Scope (Socrates-geprüft); der strukturierte Weg hängt an `docs/persona-authoring-spec.md` und kann im Plan als zweite Phase geschnitten werden.
- **Status:** done

### S-04: OEJTS-Messlauf ausführen

- **Outcome:** Nutzer kann das Instrument OEJTS wählen, eine Wiederholungszahl N setzen und einen Lauf starten; jede Wiederholung läuft in isolierter Sitzung (Item-Permutation je Instrument-Konfiguration); Antworten werden strukturiert geparst (JSON, mit Freitext-Fallback) und je Item/Wiederholung roh gespeichert; Fortschritt ist durchgehend sichtbar; einzelne Fehlantworten brechen den Lauf nicht ab.
- **Change ID:** oejts-measurement-run
- **PRD refs:** US-01, FR-010, FR-012, FR-013, NFR Lauf-Resilienz, NFR Last-Verträglichkeit, NFR Fortschritts-Feedback
- **Prerequisites:** S-02, S-03
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Gemeinfreie OEJTS-Quelle (Itemtexte, Achsen-Zuordnung, Reverse-Items, Scoring-Schlüssel) — Owner: user. Block: **yes** (PRD Open Question #2: „blockiert die Implementierung des Test-Laufs").
  - Edge-Runtime vs. lange Läufe (Lauf-Aufteilung oder Cloudflare Queues/Workers) — Owner: team (`/10x-plan`-Research). Block: no.
- **Risk:** Der schwerste Slice (Orchestrierung + Parsing + Persistenz + Edge-Limits) — bewusst direkt nach den Bausteinen sequenziert, weil er die riskanteste Annahme des Produkts trägt: dass wiederholte, isolierte Läufe praktikabel gegen externe Endpunkte fahrbar sind.
- **Status:** blocked

### S-05: Ergebnis als Verteilung und Typ (Leitstern)

- **Outcome:** Nutzer sieht nach Abschluss des Laufs je OEJTS-Achse (E/I, S/N, T/F, J/P) Lage, Streuung und Roh-Verteilung über die N Wiederholungen, plus den abgeleiteten 4-Buchstaben-Typ und dessen Stabilität; ein Einzeldurchlauf wird nie als belastbarer Wert dargestellt; Fehlquote ist ausgewiesen; ein leerer/fehlgeschlagener Lauf zeigt einen erklärenden Zustand.
- **Change ID:** distribution-results
- **PRD refs:** US-01, FR-016, NFR Reproduzierbare Auswertung, Guardrail Methodenkern
- **Prerequisites:** S-04
- **Parallel with:** S-06
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Das deterministische Scoring (gleiche Rohantworten → identische Werte) ist die testbarste Stelle des Systems — prädestiniert für die ersten Unit-Tests (Modul 3); Darstellungstiefe (Roh-Verteilung) nicht zugunsten einer einzigen Kennzahl abkürzen.
- **Status:** proposed

### S-06: Lauf-Kontrolle — Abbruch und Token-Ausweis

- **Outcome:** Nutzer kann einen laufenden Test abbrechen (Abbruch verwirft den Lauf vollständig, keine Teilauswertung) und sieht je Lauf die verbrauchten Tokens (Eingabe/Ausgabe); keine Kostenrechnung.
- **Change ID:** run-control-and-tokens
- **PRD refs:** FR-014, FR-015
- **Prerequisites:** S-04
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Abbruch-Semantik hängt an der in S-04 gewählten Lauf-Architektur (Aufteilung/Queues) — deshalb nach S-04, nicht hineingequetscht.
- **Status:** proposed

### S-07: Sichtbarkeit privat/global

- **Outcome:** Nutzer kann die Sichtbarkeit eigener Personas und Ergebnisse zwischen privat und global (org-weit) umschalten; Default ist global; Nutzer sehen ausschließlich eigene und globale Inhalte.
- **Change ID:** visibility-controls
- **PRD refs:** FR-003, §Access Control
- **Prerequisites:** S-03, S-05
- **Parallel with:** S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Das Zugriffs-Grundgerüst kommt aus F-01 — dieser Slice liefert nur die nutzerseitige Umschaltung; nach hinten sequenziert, weil im Solo-Betrieb (v1) der Default global verlustfrei trägt.
- **Status:** proposed

### S-08: Zwei Läufe vergleichen

- **Outcome:** Nutzer kann genau zwei abgeschlossene Läufe (zwei Modelle oder zwei Personas) auswählen und sieht beide Verteilungen je Achse nebeneinander mit ihren Streuungen; Läufe, Ergebnisse und Personas bleiben persistent und wiederauffindbar.
- **Change ID:** side-by-side-comparison
- **PRD refs:** US-02, FR-017
- **Prerequisites:** S-05
- **Parallel with:** S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bewusst exakt zwei Konfigurationen (Socrates-Resolution); die Versuchung, hier N-Wege-Vergleich „mitzunehmen", ist geparkt — siehe Parked.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                   | Ready for `/10x-plan` | Notes                                  |
| ---------- | ----------------------- | -------------------------------------------------------- | --------------------- | -------------------------------------- |
| F-01       | connect-supabase        | Supabase-Projekt anbinden + RLS-Grundgerüst              | yes                   | Run `/10x-plan connect-supabase`       |
| F-02       | deploy-skeleton-live    | CI-Fix + Cloudflare-Workers-Deploy mit Live-URL          | yes                   | Run `/10x-plan deploy-skeleton-live`   |
| S-01       | email-auth-live         | E-Mail-Auth end-to-end verdrahten und verifizieren        | no                    | Wartet auf F-01                        |
| S-02       | model-config-management | Modellkonfiguration mit verschlüsseltem API-Key          | no                    | Wartet auf S-01                        |
| S-03       | persona-catalog         | Persona anlegen, Katalog, Kopie-statt-Änderung           | no                    | Wartet auf S-01                        |
| S-04       | oejts-measurement-run   | OEJTS-Lauf-Engine (N Wiederholungen, isoliert, Parsing)  | no                    | Blocked: OEJTS-Quelle (Owner: user)    |
| S-05       | distribution-results    | Verteilungs- und Typ-Ansicht je Achse                    | no                    | Leitstern; wartet auf S-04             |
| S-06       | run-control-and-tokens  | Lauf-Abbruch + Token-Ausweis                             | no                    | Wartet auf S-04                        |
| S-07       | visibility-controls     | Sichtbarkeit privat/global für Personas & Ergebnisse     | no                    | Wartet auf S-03, S-05                  |
| S-08       | side-by-side-comparison | Zwei-Läufe-Vergleich nebeneinander                       | no                    | Wartet auf S-05                        |

## Open Roadmap Questions

1. **Gemeinfreie Quelle der OEJTS-Items fixieren** (Itemtext, Achsen-Zuordnung, Polung/Reverse, Scoring-Schlüssel zum 4-Buchstaben-Typ) — Owner: user. Block: S-04 (transitiv S-05, S-06, S-08). Aus PRD Open Question #2; der Datensatz ist der hartkodierte Kern des v1-Instruments.

## Parked

- **Likert-/Big-Five-Instrument (Mini-IPIP)** — Why parked: PRD §Non-Goals; folgt in einem späteren Cycle nach OEJTS.
- **Voll deklarative Test-Engine (FR-011 über das Datenmodell hinaus)** — Why parked: PRD §Non-Goals; erst beim dritten/andersartigen Instrument (YAGNI, Socrates-geprüft).
- **Admin-Rolle / Rollenzuweisung (FR-002) + Admin-UI für globale Objekte (FR-009)** — Why parked: PRD §Access Control: v1 ist einrollig; globale Objekte per Seed/Konfiguration (der Seed selbst landet in S-03/S-04-Plänen).
- **Gezieltes Teilen / Pro-Nutzer-ACL (FR-004)** — Why parked: in v1 gestrichen (Socrates); Sichtbarkeit ist zweistufig.
- **N-Wege-Vergleich** — Why parked: PRD §Non-Goals; v1 vergleicht genau zwei Konfigurationen (S-08).
- **Persona-Versionierung** — Why parked: PRD §Non-Goals; immutable + Kopie (S-03) ersetzt sie.
- **Persona-Treue-Validierung (Spec 7C)** — Why parked: PRD Open Question #1, RESOLVED: späterer Cycle.
- **Kostenschätzung** — Why parked: PRD §Non-Goals; nur Token-Zählung (S-06).
- **Observability-Ausbau (Error-Tracking, Metrics)** — Why parked: kein NFR verlangt es; top_blocker `time` hält die Liste schlank — bei Bedarf als Lesson nachziehen.

## Done

- **F-02: (foundation) Merge auf `main` deployt automatisch auf Cloudflare Workers; eine Live-URL existiert. Umfasst den CI-Fix (`master`→`main`), Repo-Secrets und die Workers-Verknüpfung — nicht mehr.** — Archived 2026-06-12 → `context/archive/2026-06-11-deploy-skeleton-live/`. Lesson: —.
- **F-01: (foundation) Ein Supabase-Projekt ist angelegt und mit der App verbunden (`.env`/`.dev.vars`); das Datenzugriffs-Grundgerüst (Nutzer sieht nur Eigenes + Globales, per Row Level Security) ist als Contract etabliert — nicht das fertige Schema, nur der minimale Anker, an den Slices ihre Tabellen hängen.** — Archived 2026-06-13 → `context/archive/2026-06-12-connect-supabase/`. Lesson: —.
- **S-01: Nutzer kann sich per E-Mail + Passwort registrieren, anmelden, abmelden und erreicht geschützte Seiten; Unangemeldete landen auf der Anmeldung.** — Archived 2026-06-15 → `context/archive/2026-06-13-email-auth-live/`. Lesson: CI-Lint-Fehler skippt den deploy-Job lautlos (Prod blieb auf altem Stand) — nach Push auf `main` immer den deploy-Job prüfen.
- **S-02: Nutzer kann ein OpenAI-kompatibles Modell anhängen (Base-URL, API-Key, Modellname) und als wiederverwendbare Konfiguration speichern; der Key liegt verschlüsselt at rest und verlässt den Server nie Richtung Client.** — Archived 2026-06-16 → `context/archive/2026-06-15-model-config-management/`. Lesson: DELETE/UPDATE hinter RLS müssen die betroffene Zeilenzahl prüfen — ein 0-Row-Match (fremde id) ist kein Erfolg, sonst meldet der Endpoint fälschlich `ok:true`; SSRF-Guards zusätzlich gegen numerische IPv4-Schreibweisen (dword/octal/hex) härten.
- **S-03: Nutzer kann eine Persona anlegen (System-Prompt frei oder strukturiert nach Spec) mit Name, Beschreibung, Tags; sie im Katalog wiederfinden und für Läufe auswählen; Änderung erzeugt eine neue Kopie (Personas sind unveränderlich).** — Archived 2026-06-17 → `context/archive/2026-06-17-persona-catalog/`. Lesson: Sichtbarkeits-Default an user-scoped Tabellen muss explizit `private` sein — ein DB-Default `global` plus fehlendes `visibility` beim Insert leakt nutzerangelegte Zeilen cross-tenant (impl-review F1); globale Objekte nur per Seed/Migration.
