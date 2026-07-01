# Feature: Modellname als Combobox aus der Verbindungstest-Modellliste

**Erstellt:** 2026-07-01
**Ziel:** Beim Anlegen/Bearbeiten einer Modellkonfig den Modellnamen aus den real verfügbaren Provider-Modellen wählen, statt ihn blind zu tippen.
**Prioritaet:** Mittel
**Status:** Fertig zum Testen

---

## Executive Summary

Der Verbindungstest (`POST /api/models/test-connection`) ruft bereits `GET {baseUrl}/models`
mit dem entschlüsselten Key ab und zeigt „Verbindung ok — 127 Modelle" — nutzt aber **nur den
Count** und verwirft die Modell-IDs. Dieses Feature gibt die IDs zusätzlich an den Client zurück
und bietet sie im Feld **„Modellname"** als **durchsuchbare Combobox mit Freitext-Fallback** an.
So entfällt das fehleranfällige blinde Tippen exakter Modellnamen (z. B. `gpt-4o`), ohne die
Flexibilität für nicht-gelistete Modelle zu verlieren.

---

## Scope / Abgrenzung

### Enthalten

- **Server** (`src/pages/api/models/test-connection.ts`, `probeModels`): Response um
  `models: string[]` (die `data[].id`) erweitern — **additiv** zur bestehenden `modelCount`.
- **UI** (`src/components/models/ModelConfigManager.tsx`): „Modellname" nach erfolgreichem
  Verbindungstest als native **`<datalist>`** (durchsuchbar) aus der zurückgegebenen Liste
  befüllen; Auswahl setzt das Feld. Liste invalidiert bei Änderung von Base-URL/Key.
- **Freitext-Fallback:** Ein Modell, das nicht in der Liste steht, bleibt frei eintippbar
  (vor dem Test **und** falls der Provider ein gewünschtes Modell nicht listet) — `<datalist>` by design.
- Response-Parsing client-seitig im bestehenden Stil dieser Datei (`as`-Cast + `Array.isArray`-Guard
  auf das additive `models`-Feld); kein neues zod-Schema (test-connection nutzt nicht die run-schemas).

### Nicht enthalten

- **Keine** Persistierung/Caching der Modell-Liste (sie wird pro Verbindungstest frisch geholt).
- **Kein** provider-spezifisches Filtern/Kategorisieren (Embeddings/TTS/Whisper etc. bleiben in
  der durchsuchbaren Liste; Filtern wäre heuristisch und fehleranfällig → Non-Goal).
- **Keine** Änderung an Scoring, Run-Flow oder der Verschlüsselung.
- **Kein** neuer API-Endpunkt — die Liste kommt aus dem bestehenden `test-connection`-Aufruf.

---

## Risiken & Mitigationen

| Risiko                                                              | Wahrscheinlichkeit | Impact  | Mitigation                                                                             |
| ------------------------------------------------------------------- | ------------------ | ------- | -------------------------------------------------------------------------------------- |
| 127 Einträge inkl. Nicht-Chat-Modellen → unübersichtliches Dropdown | Hoch               | Niedrig | **Durchsuchbare** Combobox statt reiner Liste; sortiert                                |
| Modell-Liste erst **nach** dem Verbindungstest verfügbar            | Hoch               | Niedrig | Vor dem Test bleibt es Freitext; Combobox erscheint nach „Verbindung testen"           |
| Provider liefert `/models` ohne `data`-Array (nicht-OpenAI-konform) | Niedrig            | Niedrig | `models` bleibt leer → Freitext-Fallback greift automatisch                            |
| Response-Form-Drift bricht Client                                   | Niedrig            | Mittel  | `models` rein additiv; Client liest mit `Array.isArray`-Guard, fehlt es → Freitext     |
| Key-Leak über die neue Response                                     | Niedrig            | Hoch    | `probeModels` gibt **nur** IDs zurück, nie Key/Upstream-Header (bestehende Invariante) |

---

## Dependencies

### Erforderlich vor Start

- [x] Funktionierender Verbindungstest (gegeben — verifiziert „127 Modelle" nach ENCRYPTION_KEY-Fix)
- [x] ~~shadcn `Command`-Komponente~~ → **verworfen:** native `<datalist>` gewählt (kein neuer Dependency, native Suche, Freitext-Fallback inklusive)

### Referenz-Dokumente

- `src/pages/api/models/test-connection.ts` — `probeModels` (Modell-Fetch, heute nur Count)
- `src/components/models/ModelConfigManager.tsx` — Modellkonfig-Formular (Modellname-Feld)
- `src/lib/api-responses.ts` — Response-Form (`json`/`jsonError`)
- `context/archive/2026-06-30-refactor-opportunities/plan.md` — zod-`safeParse`-Naht (Muster für additive Response-Felder)

---

## Success Criteria

**Das Feature gilt als erfolgreich wenn:**

- [ ] Nach „Verbindung testen" erscheint das Modellname-Feld als durchsuchbare Liste der real verfügbaren Modelle. _(Live-Abnahme offen)_
- [ ] Auswahl eines Listeneintrags setzt den Modellnamen korrekt; Speichern übernimmt ihn. _(Live-Abnahme offen)_
- [x] Ein nicht-gelistetes Modell lässt sich weiterhin per Freitext eintragen. _(`<datalist>` erlaubt Freitext by design)_
- [x] Der API-Key erscheint in **keiner** Response (`probeModels` gibt nur `models`-IDs zurück).
- [x] Bestehendes Speichern/Bearbeiten unverändert (Formularlogik nicht angefasst; `models` rein additiv).
- [x] Unit-Tests grün (65/65, inkl. 5 `extractModelIds`); `npm run build`/`lint` grün.

---

**Erstellt mit:** `/dtb:feature-plan`
