---
title: "Architektur-Report — 10xArchitect (Modul 4)"
created: 2026-07-01
type: architect-report
author: Damian Spyra (via Claude Opus 4.8)
scope: "Ein Repository (persona-forge) über alle vier Artefakte L2–L5"
---

# Architektur-Report — 10xArchitect (Modul 4)

> Two-Pager für das Zertifizierungs-Formular. Synthese ausschließlich aus den vier
> Modul-4-Artefakten (L2 Map, L3 Research, L4 Plan, L5 Domäne). Jede strukturelle Aussage
> ist im jeweiligen Artefakt belegt; hier nur die Verdichtung.

## 1. Beschriebene Projekte

Der komplette Architect-Pfad lief auf **einem** Repository — bewusst, nicht auf einem
fremden Übungs-Repo.

| Projekt                                                                                                                                                                | Stack                                                                                            | Skala                                           | Artefakte      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------- |
| **persona-forge** — Web-Tool für psychometrisches LLM-Profiling: fährt gemeinfreie Tests (v1: OEJTS) mit N Wiederholungen gegen LLMs und liefert Verteilungen je Achse | Astro 6 SSR + React 19 + TypeScript + Tailwind 4 + Supabase (Postgres/Auth) + Cloudflare Workers | ~68 TS/TSX-Module, 172 Commits / 20 Tage / Solo | L2, L3, L4, L5 |

## 2. Projekt-Map (L2)

- **Drei-Schichten-Architektur:** Astro-Pages/API-Routes (Entry, instabil I≈75–100 %) →
  React-Inseln → `src/lib/` (Business-Logik, stabiles Fundament mit hohem afferentem
  Coupling). Deploy auf Cloudflare, Zustand in Supabase.
- **Ein klares Zentrum:** der **Mess-/Run-Flow** (`services/runs.ts` Ca 9 +
  `instruments/oejts.ts` Ca 7 + Run-Inseln) ist Aktivitäts-Hotspot **und**
  Blast-Radius-Kern zugleich → der natürliche Deep-Focus-Kandidat für L3.
- **Querschnitte mit hohem Risiko:** Auth (`middleware.ts` + `api-auth.ts`, 10 Importeure)
  und verschlüsselte LLM-Keys (`model-configs.ts` + `crypto.ts`); dazu `api-responses.ts`
  (11 Importeure) — eine Form-Änderung dort strahlt auf jede Route.
- **Gesunde Statik:** keine Import-Zyklen, keine toten Module; jedes Feature bewegt
  `lib`+`pages`+`components` als vertikaler Slice.
- **Größter Unknown (ehrlich benannt):** die `.astro`-Routing-Schicht ist für statische
  Tools unsichtbar; Aussagen zu stabil-vs-tot sind bei 20 Tagen Historie nicht ableitbar.

## 3. Feature-Analyse (L3)

**Untersuchter Flow und Grund:** der OEJTS-Mess-/Run-Flow (Lauf starten → N Wiederholungen
gegen ein LLM → Verteilung/Typ je Achse) — aus der Map als fachlicher Kern und
Coupling-Zentrum gewählt.

**Feature overview:** Der Flow ist ein **client-getriebener Step-Loop** — die `RunRunner`-Insel
ruft pro Wiederholung genau **einen** `POST /api/runs/[id]/step`, der gesamte Zustand liegt in
Supabase (`runs` + `run_repetitions`). Das umgeht das Cloudflare-Edge-Zeitlimit **ohne**
Queue/Worker. Scoring und Aggregation sind reine, unit-getestete Logik; die Ergebnis-Aggregate
werden **nicht persistiert**, sondern bei jedem SSR-Aufruf deterministisch neu berechnet
(eine Quelle der Wahrheit = die DB-Reps).

**Technical Debt (Top 3):**

1. **LLM-Client-Fehlerpfade komplett ungetestet** (`openai-compatible.ts`:
   Retry/Backoff/Timeout/jsonMode-Fallback) — die gefährlichste Lücke; breit genutzte
   Netzlogik, ein Regress bliebe still.
2. **D1 — „ok" ≠ „verwertbar":** eine Wiederholung gilt bei `okCount≥1` als `ok`
   (`runs.ts:401`), Scoring braucht aber alle 8 Items einer Achse (`oejts-score.ts:37`) →
   stille Semantik-Lücke (Fehlquote sinkt, ohne dass ein Ergebnis verwertbarer wird).
3. **Fragile Entity↔View-Naht:** handgepflegter `VIEW_COLUMNS`-String + `toView`-Mapper und
   **ungeprüfte `as`-Casts** über die HTTP-Grenze. **ast-grep-verifiziert** und dabei von
   Vermutung zu Evidenz geschärft: die Casts liegen an exakt drei Stellen **einer** Datei
   (`RunRunner.tsx:180/211/258`) — ein zod-Validator dort schließt die ganze dynamische Naht.

## 4. Refaktor-Plan (L4)

**Was refaktoriert:** **C-B** — ein **zod-Validator an der `RunRunner`-Insel↔HTTP-Naht**. Der
Client parst jede Erfolgs-Response gegen `z.infer`-Schemas (`run-schemas.ts`, non-strict);
Drift erzeugt einen kontrollierten `serverError`-Banner statt eines stillen Render-Fehlers.
`types.ts` wird **Single Source** (`z.infer`-Re-Export) plus **Compile-Guard**
(`MutualExtends`) gegen `RunStatus`/`Visibility`-Drift.

**Bewusst NICHT getan:** C-C (Constraint-Single-Source — bewusste Defense-in-Depth), C-A
(Supabase-Typgen — bewusst + CI-abgesichert), D1 (Geschäftskonzept, verschoben nach L5).

**Phasen (guard-first):**

- Phase 1 — `run-schemas.ts` + `z.infer`-Typen + Compile-Guard + 12 Unit-Tests · _auto_
  (`npm run test`/`build`/`lint`).
- Phase 2 — 3 `as`-Casts einzeln auf `safeParse` umgestellt (je eigener Commit) · _auto_
  (Typecheck, `git grep "as RunView" = 0`) **+ manuell** (echter Messlauf durch alle drei
  Pfade; DevTools-Drift-Test zeigt Banner, Loop bricht sauber ab).

Umgesetzt, reviewt (plan-review SOUND, impl-review APPROVED) und **live deployt** (Prod 200).

## 5. Domäne nach DDD (L5)

**Ubiquitous Language (Kernbegriffe):** _Lauf_ (selbst-enthaltene N-fache Ausführung),
_Wiederholung/rep_ (isolierte Sitzung), _Achsen-Verteilung_ (Lage + Streuung statt Punktwert),
_Belastbarkeit_. Gefährlichstes Homonym: **„Persona"** = Domänen-Testobjekt vs. Nutzer-Rolle.
Zentraler Vision-Begriff **„Disposition" FEHLT im Code** (nur UI-Text, implizit `RunAggregate`).

**Wichtigste Model-vs-Code-Rozjazdy:** (a) das `permute`-Flag ist **toter Vertrag** —
deklariert (`types.ts:192`), aber der Orchestrator permutiert immer hart (`runs.ts:376`);
(b) die Belastbarkeits-Regel lebt **nur im UI** (`RELIABLE_MIN=2`, `axis-chart.tsx:14`),
während API/DB/Aggregat N=1 als fertiges `ready`-Ergebnis zulassen.

**Invariante #1 + Aggregat:** „**Ein Ergebnis wird nie als belastbar dargestellt, wenn es aus
weniger als N_min verwertbaren Wiederholungen stammt**" — der einzige als _unverletzlich_
markierte Guardrail und zugleich der am **schwächsten** erzwungene (Grep `reliab` über
`src/lib` = null Produktionscode). Gehört an das Aggregat **Lauf** (`RunAggregate`); Design:
domänen-berechnetes `reliability`-Verdikt + Single-Source-Konstante `MIN_RELIABLE_REPS` +
fail-fast `UnreliableRunError` für Vertragspfade.

**Anti-Corruption-Layer:** schlimmster Leak = **Supabase-Client**, sickert durch **5 Schichten /
6 Dateien** (Typ `SupabaseClient` 4× Zeichen-für-Zeichen dupliziert; Postgres-Fehlercode
`"23505"` als String-Match in der Businesslogik, `runs.ts:423`). Ehrlich dimensioniert: der
Leak ist **mild** — er erreicht weder UI noch reine Scoring-Domäne; `openai-compatible.ts` ist
bereits ein lehrbuchreiner ACL und dient als Vorbild. Prüfbares Zukunfts-Kriterium:
`grep @supabase src/` darf nur noch das Adapter-Verzeichnis treffen.

## 6. Entscheidungen, die mir gehören

Ich habe den Architect-Pfad bewusst auf meinem **echten Produkt** statt einem Wegwerf-Repo
gefahren — damit die Diagnosen direkt in die Roadmap fließen, nicht in eine Übung. Beim
L4-Ranking hat mich die **Intentionalitäts-Lupe** (Git-Archäologie statt ADRs) überzeugt, den
L3-spektakulärsten Befund (die `VIEW_COLUMNS`-Naht, C-A) auf den **letzten** Platz zu setzen:
er ist bewusst gewählt und CI-abgesichert, also „guard, nicht Umbau" — und **C-B** zu wählen,
das einzige _zufällige_ Komplexitäts-Problem mit kleinem, umkehrbarem Pfad. **D1** habe ich
gegen den ersten Reflex _nicht_ als mechanischen Refaktor behandelt, sondern nach L5 verschoben,
weil es ein fehlendes **Geschäftskonzept** ist (Scoring-Yield-Quote vs. Antwort-Fehlquote),
nicht verhaltenserhaltend. In L5 stimme ich zu, dass Belastbarkeit Invariante #1 ist, übernehme
aber den **Einwand des Design-Agenten** gegen den Distillation-Vorschlag: Belastbarkeit gehört
in ein eigenes `reliability`-Feld, **nicht** in `RunResultView.state` — `state` ist ein
Render-Diskriminator und dazu orthogonal. Diese Abwägung ist meine, wenn ich den Plan in ein
`change-id` überführe. Das Werkzeug (Agenten, ast-grep, Git-Historie) liefert Kandidaten und
Belege; die Wahl, was Kern ist und was warten kann, bleibt bei mir.
