# Design: z.ai Reasoning abschalten (`thinking:disabled`)

**Datum:** 2026-07-01
**Status:** Entwurf zur Review
**Autor:** Damian (via Brainstorming mit Claude)

## Problem

z.ai-GLM-Modelle (z. B. `glm-5.2`) „denken" per Default vor jeder Antwort. Bei einem
OEJTS-Lauf (System-Prompt + 32 Items + JSON-Zwang) erzeugt das großes `reasoning_content`
und dauert ~9–16 s pro Wiederholung. Jede Wiederholung läuft einzeln über
`POST /api/runs/[id]/step` auf Cloudflare Workers (client-getrieben); die langen
Reasoning-Calls laufen dort ins Edge-Zeitlimit → „sehr lange, kein Ergebnis".

Live verifiziert (2026-07-01): derselbe Request mit `"thinking":{"type":"disabled"}`
antwortet in ~2,8 s mit sauberem JSON (`reasoning_tokens: 0`), statt 9–16 s. Unser
Client (`src/lib/llm/openai-compatible.ts`) sendet dieses Feld heute nicht.

## Ziel

`chatCompletion` sendet `thinking:{type:"disabled"}` **nur** an z.ai-Endpunkte, damit
GLM-Läufe schnell und mit direkt parsebarem JSON antworten — ohne den OpenAI-Pfad zu
berühren.

## Nicht-Ziele (YAGNI)

- **Kein** Per-Config-Toggle „Reasoning aus" (keine DB-Migration, keine UI). Löst den
  einen realen Fall nicht besser als das Host-Gate.
- **Keine** Modellname-Heuristik (`glm*`): ein GLM-Modell über ein anderes striktes
  Gateway könnte ein unbekanntes `thinking`-Feld mit 400 ablehnen.
- **Keine** Fehler-Durchreichung / UI-Fehleranzeige (separater Vorgang).
- **Kein** China-Endpunkt `open.bigmodel.cn` (wird nicht genutzt).

## Gewählter Ansatz

**Host-Gate auf z.ai.** In `chatCompletion` wird per Hostname erkannt, ob der Endpunkt
z.ai ist; nur dann kommt `thinking:{type:"disabled"}` additiv in den Request-Body.
Begründung: trennt sauber z.ai von OpenAI (`api.openai.com` würde ein unbekanntes
Feld mit 400 ablehnen), braucht keine Migration/UI und deckt beide z.ai-Endpunkte ab
(`api.z.ai/api/paas/v4` und `api.z.ai/api/coding/paas/v4`).

## Architektur

Alle Änderungen in **einer** Datei: `src/lib/llm/openai-compatible.ts` (+ Test).

### 1. Reiner Helfer `isZaiEndpoint`

Exportiert (unit-testbar, kein I/O):

```ts
/** True, wenn der Endpunkt zu z.ai gehört (Host endet auf „z.ai"). */
export function isZaiEndpoint(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname.endsWith("z.ai");
  } catch {
    return false;
  }
}
```

- `https://api.z.ai/api/paas/v4/` → `true`
- `https://api.z.ai/api/coding/paas/v4/` → `true`
- `https://api.openai.com/v1` → `false`
- Müll-String → `false` (kein Wurf)

Hinweis zur Präzision: `hostname.endsWith("z.ai")` (nicht `url.includes("z.ai")`), damit
ein Pfad-/Query-Segment „z.ai" keinen False-Positive erzeugt.

### 2. Wiring in den Request-Body

Im bestehenden `body: JSON.stringify({...})` (heute `openai-compatible.ts:125-129`)
additiv ergänzen:

```ts
body: JSON.stringify({
  model: args.model,
  messages: args.messages,
  ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  ...(isZaiEndpoint(args.baseUrl) ? { thinking: { type: "disabled" } } : {}),
}),
```

- Die Berechnung `isZaiEndpoint(args.baseUrl)` einmalig vor der `for`-Schleife in eine
  Konstante ziehen (`const disableThinking = isZaiEndpoint(args.baseUrl);`), da sich
  `baseUrl` über die Versuche nicht ändert; im Body `...(disableThinking ? … : {})`.
- Greift in ALLEN drei Versuchen, auch beim jsonMode-Off-Retry (dort fällt nur
  `response_format` weg, `thinking` bleibt).
- Verhaltenserhaltend für OpenAI: `api.openai.com` → Feld nie gesetzt.

### 3. Keine Änderung an der Antwort-Verarbeitung

`extractContent` liest weiterhin `choices[0].message.content`. Mit deaktiviertem
Reasoning füllt z.ai `content` direkt mit dem JSON (live verifiziert) — der bestehende
`parseOejtsResponse`-Pfad greift unverändert. Kein Feld-Umbau nötig.

## Tests (Unit, Node-Vitest, Docker-frei)

Neue Datei `src/lib/llm/openai-compatible.test.ts`:

1. **`isZaiEndpoint`** — die vier Fälle oben (2× z.ai true, OpenAI false, Müll false).
2. **Body-Wiring via `fetch`-Stub** — `vi.stubGlobal("fetch", …)` mit einer minimalen
   200-JSON-Antwort (`choices[0].message.content` = `'{"answers":[]}'`, plus `usage`):
   - z.ai-`baseUrl` → der an `fetch` übergebene Body (aus `JSON.parse(init.body)`) enthält
     `thinking: { type: "disabled" }`.
   - OpenAI-`baseUrl` → derselbe Body enthält **kein** `thinking`-Feld.
     Damit ist das eigentliche Verhalten (nicht nur der Helfer) abgedeckt. `afterEach`
     stellt `fetch` wieder her (`vi.unstubAllGlobals()`).

## Deployment

Reiner Code-Change (keine Migration). Nach Merge: `main` pushen → Worker-Deploy + CI.
Live-Abnahme: z.ai-Lauf starten → Wiederholungen laufen in ~2–3 s statt 10–16 s durch,
Ergebnis erscheint zügig.

## Offene Risiken

| Risiko                                                      | Mitigation                                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ein Nicht-z.ai-Provider mit Host `*.z.ai` bekäme `thinking` | Praktisch nur z.ai betreibt `*.z.ai`; das Feld wäre dort ohnehin gültig                                                                                                                        |
| z.ai ändert/ablehnt das `thinking`-Schema                   | Additives Feld, heute live als akzeptiert verifiziert. Bei künftiger Ablehnung (400/422) endet der betroffene Rep sauber als `failed` (kein Endlos-Retry, kein Hänger) — Restrisiko akzeptiert |
| GLM über anderes Gateway (nicht `*.z.ai`) bliebe langsam    | Bewusst Non-Goal; Host-Gate deckt den genutzten Fall; spätere Erweiterung möglich                                                                                                              |
