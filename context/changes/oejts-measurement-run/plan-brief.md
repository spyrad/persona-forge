# OEJTS-Messlauf (S-04) — Plan Brief

> Full plan: `context/changes/oejts-measurement-run/plan.md`

## What & Why

Der Methodenkern: ein angemeldeter Nutzer fährt ein psychometrisches Instrument (OEJTS) **N-mal unter
isolierten Bedingungen** gegen eine Modell-/Persona-Kombination und legt damit die Rohdaten, aus denen
S-05 die Dispositions-Verteilung ableitet. S-04 baut den **Lauf** (Orchestrierung, Roh-Persistenz,
Fortschritt, Abbruch, Token-Zählung) — den ersten echten „Mess"-Schritt des Produkts.

## Starting Point

S-02 liefert Modellkonfigs mit serverseitig entschlüsselbarem Key (`getDecryptedTarget`), S-03 den
Persona-Katalog (`systemPrompt`). Ein **echter LLM-Call existiert noch nicht** — nur ein `GET /models`-Probe.
RLS-, Service-, API- und Island-Muster sind etabliert; das OEJTS-Instrument liegt vollständig in
`context/foundation/instruments/oejts-1.2.json`.

## Desired End State

Unter `/runs` startet der Nutzer einen Lauf (Persona + Modellkonfig + N), sieht den Fortschritt live
hochzählen, kann abbrechen (= Lauf gelöscht), und sieht nach Abschluss Status, Fehlquote und
Token-Verbrauch. Rohantwort + geparste Item-Werte (1–5) + verwendete Reihenfolge liegen je Wiederholung
in der DB — bereit für die S-05-Auswertung.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Call-Granularität | 1 Call/Wiederholung (alle 32 Items, JSON) | N statt 32N Calls → Edge-Limit unkritisch, passt „isolierte Sitzung" | Plan |
| Ausführungs-Architektur | Client-orchestrierte Chunks (1 Wdh./Request) | Keine neue CF-Infra (Queues/DO), jeder Request bounded | Plan |
| Strukturierte Ausgabe | JSON-Mode + Freitext-Fallback-Parser | Robust + FR-013 (schwächere Modelle) | Plan |
| Datenmodell | `runs` + `run_repetitions` (Items als jsonb) | Wenig RLS, instrument-agnostisch (FR-011) | Plan |
| Permutation | An, Seed/Order je Wdh. gespeichert | Reduziert Positions-Bias, reproduzierbar (NFR) | Plan |
| Wiederholungen N | 1–25, Default 5 | Sinnvolle Verteilung bei small-scale/after-hours | Plan |
| Abbruch | Lauf komplett löschen | FR-014 (keine partielle Auswertung) | Plan |
| Resilienz | ≥1 Wdh. verwertbar → completed + Fehlquote | NFR-Resilienz, US-01-AC | Plan |
| Tokens / Last | API-`usage`, sequentiell + Retry/Backoff | FR-015 + NFR Last-Verträglichkeit | Plan |
| Sichtbarkeit | `visibility` default `private` (Toggle = S-07) | S-03-Lesson F1 (privacy-by-default) | Plan |
| UI-Scope | Start + Fortschritt + Liste, KEINE Ergebnisansicht | Sauberer Schnitt zu S-05 (FR-016) | Plan |

## Scope

**In scope:** `runs`/`run_repetitions` + RLS · OEJTS-Instrument-Modul · reine Funktionen (Prompt, Permutation,
Parser) + Tests · LLM-Client · Orchestrierungs-Schritt-API · `/runs`-UI mit Fortschritt/Abbruch · Token-Zählung.

**Out of scope:** Achsen-Aggregation/Verteilung/Typ/Ergebnisansicht (S-05) · Vergleich (FR-017) · Visibility-Toggle
(S-07) · deklarative Engine / 2. Instrument · Queues/DO · Kostenschätzung · Parallelität.

## Architecture / Approach

`POST /api/runs` legt den Lauf an (`pending`). Der Client schleift `POST /api/runs/[id]/step` — jeder Aufruf
verarbeitet genau **eine** Wiederholung: Key entschlüsseln → 32 Items permutieren → Prompt (System=Persona,
User=OEJTS+JSON-Aufforderung) → `chatCompletion` (JSON-Mode, Retry/Backoff) → parsen → `run_repetition`
persistieren → Lauf-Aggregat (Tokens, Fehlquote) fortschreiben. Loop bis `completed`/`failed`. Abbruch =
`DELETE`. Neue Bausteine: `src/lib/instruments/oejts.ts`, `src/lib/runs/oejts-run.ts`, `src/lib/llm/openai-compatible.ts`.

## Phases at a Glance

| Phase | Liefert | Hauptrisiko |
| --- | --- | --- |
| 1. Reiner Kern + Datenmodell | Migration + Instrument-Modul + getestete Funktionen (Prompt/Permutation/Parser) + Service-Grundgerüst | Parser-Robustheit gegen reale Modell-Antworten |
| 2. LLM-Call + Orchestrierung | Chat-Completion-Client + `/step`-Endpoint (Lauf end-to-end per API) | JSON-Mode-Support uneinheitlich; Resilienz/Token-Korrektheit |
| 3. UI `/runs` | Start + Live-Fortschritt + Abbruch + Liste | Client-Loop-Robustheit (Tab-Schließen → Lauf stockt) |

**Prerequisites:** S-02 (Modellkonfig) + S-03 (Persona) — beide live. Instrument-Daten vorhanden.
**Estimated effort:** ~2–3 Sessions über 3 Phasen.

## Open Risks & Assumptions

- JSON-Mode-Support variiert je Endpunkt → Freitext-Fallback ist Pflicht, tolerant gegen `response_format`-Ablehnung.
- Client-orchestriert: schließt der Nutzer den Tab, stockt der Lauf (`running`); v1 hat kein Resume — löschen & neu starten (kein Auto-Cleanup).
- Endpunkte ohne `usage` → Tokens „unbekannt" (kein Schätzer in v1).
- Annahme: `base_url` ist die API-Wurzel (`{baseUrl}/chat/completions`), konsistent mit `test-connection`.

## Success Criteria (Summary)

- Lauf gegen echten Endpunkt fährt N isolierte, permutierte Wiederholungen durch; Rohdaten + Werte + Tokens + Fehlquote persistiert.
- Abbruch verwirft den Lauf vollständig; einzelne Fehlantworten brechen ihn nicht ab (≥1 verwertbar → completed).
- Nur eigene/globale Läufe sichtbar (RLS); Key verlässt nie den Server.
