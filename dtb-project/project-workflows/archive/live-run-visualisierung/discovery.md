# Discovery: Live-Run-Visualisierung

<!-- resume: done -->

**Erstellt:** 2026-07-18
**Idee-Referenz:** Inbox #5 — "Live-Ansicht während laufender Tests grafisch aufwerten — während ein Testlauf läuft, den Fortschritt/Zustand lebendiger darstellen statt statisch. Inspiration: fable-25.netlify.app/pulse/ (Pulse-/Live-Effekt)."
**Status:** Abgeschlossen

---

## Betroffene Module

| Pfad                                | Beschreibung                                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/runs/RunRunner.tsx` | Kern: Live-Fortschritts-Panel (heute Textzeilen + simple Progress-Bar) wird zur „Live-Bühne". Live-Daten je Step vorhanden: `completedReps/totalReps`, `failedCount`, Tokens, `lastRepDurationMs`, `lastRepError`, Steadfastness-Phase/Runde/Strategie |
| `src/styles/global.css`             | Design-Tokens + etabliertes Animations-Muster (`tw-animate-css`, `page-enter`-Keyframes, `prefers-reduced-motion`-Gating als Vorbild)                                                                                                                  |
| `src/lib/runs/run-schemas.ts`       | `runProgressSchema` — Quelle der Live-Datenform (nur Referenz, KEINE Änderung — siehe Scope)                                                                                                                                                           |
| `src/lib/services/runs.ts`          | Serverseitige Step-Logik (nur Referenz, KEINE Änderung — siehe Scope)                                                                                                                                                                                  |
| `src/pages/runs.astro`              | Hostet die RunRunner-Insel — vermutlich unberührt                                                                                                                                                                                                      |
| `src/lib/runs/run-timing.ts`        | `formatDuration` — Anzeige der Modell-Zeit (Referenz)                                                                                                                                                                                                  |

**Kontext-Erkenntnis aus dem Scan:** Die Inbox-Sorge „Machbarkeit unter Cloudflare-Edge-Lauf-Aufteilung" ist entschärft — der Client treibt den Lauf bereits selbst (`POST /api/runs/[id]/step`) und erhält nach jeder Wiederholung ein `RunProgress`. Live-Daten sind vorhanden; das Feature ist ein reines Präsentations-Feature.

---

## Anforderungen

### Scope

**Enthalten:**

- **Ausbaustufe B — „Live-Bühne"** (entschieden gegen A = minimale Panel-Aufwertung und C = Live-Ergebnis-Vorschau mit neuen Server-Feldern):
  - N Zellen/Punkte, eine je Wiederholung, die nacheinander aufleuchten (Erfolg = Teal-Puls, Fehler = Destructive-Blitz)
  - Herzschlag-Idle-Puls, solange das Modell antwortet (zwischen Steps)
  - Animiert hochzählende Zähler (Tokens, Reps)
- **Alle Lauf-Arten** (Mittelweg): Item-Läufe (OEJTS/HEXACO) mit 1 Zelle = 1 Wiederholung; Steadfastness mit 1 Zelle = 1 Fakt, Runden/Strategie als Textzeile darunter (keine eigene Runden-Animation); Phase `generating` zeigt Herzschlag-Puls ohne Zellen-Fortschritt
- **Steadfastness-0-Tokens kaschieren statt fixen:** Während der Runden ehrliche Zustands-Anzeige (Herzschlag + „Runde X läuft…") statt prominent toter 0-Token-Zähler

**Nicht enthalten:**

- KEINE Änderungen an `runProgressSchema` / `RunProgress` (keine neuen Felder)
- KEINE Änderungen an Server-Step-Logik (`runs.ts`) oder API-Routen, KEINE DB-Migrationen
- KEIN Fix des geparkten Minors „Live-Progress 0 Tokens während Steadfastness-Runden" (bleibt separates Ticket; Bühne kaschiert nur die Anzeige)
- KEINE eigene Steadfastness-Inszenierung mit Runden-/Strategie-Animation (Variante 3 verworfen)
- KEINE Live-Achsen-/Verteilungs-Vorschau während des Laufs (Variante C verworfen)

**Erlaubter Datei-Fussabdruck:** `RunRunner.tsx` (+ ggf. neue kleine Komponenten unter `src/components/runs/`), `src/styles/global.css` (Keyframes/Tokens).

### Gewuenschtes Verhalten

- **Grundstimmung „ruhig-konzentriert":** langsamer Herzschlag (~1–2 s Zyklus), dezentes Glühen, Zellen leuchten sanft auf und beruhigen sich — „Messgerät bei der Arbeit", unaufdringlich genug, den Tab offen zu lassen. Bewusst NICHT energetisch/laut.
- **Bühne ERWEITERT das Panel** (ersetzt es nicht): die bestehenden Text-Infos (Reps, Tokens, Zeiten, letzter Fehler) bleiben erhalten; die Bühne kommt als visuelle Ebene dazu.
- **Bestehende UX-Muster übernehmen:**
  - Farb-Semantik unverändert: Amber (`chart-2`) = „läuft", Teal (`primary`) = Fortschritt/Erfolgs-Puls, `destructive` = Fehler-Zelle, `success` = fertig. Keine neuen Farben, nur semantische Tokens.
  - Motion-Bauart aus `global.css`: CSS-only-Keyframes (Vorbild `page-enter`), Gating via `@media (prefers-reduced-motion)`; keine JS-Animations-Bibliothek.
  - `tabular-nums` für alle tickenden Zähler.
- **Abschluss-Moment am Lauf-Ende:** alle Zellen pulsieren einmal in `success` (bzw. `destructive` bei `failed`), ~1–2 s, dann blendet das Panel sanft aus — kein abrupter Schnitt wie heute.

### Randfaelle

- **Einzelne Wiederholung schlägt fehl:** betroffene Zelle blitzt `destructive` auf und bleibt gedimmt-destruktiv markiert; der Lauf pulst ruhig weiter; sticky `lastRepError`-Textzeile wie heute.
- **Ganzer Lauf endet `failed`:** Abschluss-Moment in `destructive`, dann sanftes Ausblenden (siehe 3b).
- **Netzwerk-/Serverfehler mittendrin** (Loop stoppt, Lauf bleibt serverseitig „running" hängen): Zellen **frieren grau ein** + Fehlerbanner — erkennbarer „unterbrochen"-Zustand statt hartem Sofort-Verschwinden.
- **N = 1:** kein Sonderlayout — fixe Zellgröße, zentriert; eine Zelle mit Herzschlag.
- **N = 25 (Cap):** fixe Zellgröße mit Grid-Umbruch, Zellen werden nicht gequetscht.
- **`prefers-reduced-motion: reduce`:** alle Animationen aus (kein Herzschlag/Puls/Zähler-Ticken); Bühne bleibt als statische Zustandsanzeige (harte Farbwechsel der Zellen); Abschluss-Moment entfällt; Panel blendet ohne Übergang aus.
- **Seiten-Reload während des Laufs:** Bühne erscheint nach Reload nicht (Client-Loop verloren, Status quo); „Lauf wieder aufnehmen" wäre ein eigenes Feature (Backend-Grenze).
- **Abbruch durch Nutzer (Cancel + confirm):** exakt wie heute — kein Abschluss-Moment, Panel verschwindet sofort, Lauf wird hart gelöscht.

### Einschraenkungen

**Technisch:**

- **Keine neuen Dependencies:** kein framer-motion, kein Canvas/WebGL — `tw-animate-css` + eigene CSS-Keyframes reichen für max. 25 Zellen. Von der Pulse-Inspiration wird die Stimmung übernommen, nicht die Technik (Canvas/Web-Audio).
- **Animation CSS-first:** Herzschlag/Puls/Glow rein per CSS (GPU-freundlich); JS nur für Zustandswechsel (Zellen-Status, Zähler-Zielwerte); kein `requestAnimationFrame`-Dauerloop.
- **Beide Themes gleichwertig** (Light + Dark), ausschließlich semantische Tokens (Projektregel: keine Farb-Literale).
- **E2E-Verträglichkeit:** Textanker des Panels („Run in progress…", Zähler-Texte) bleiben erhalten — Bühne ergänzt, ersetzt nicht.

**Fachlich:**

- **Ehrliche Darstellung:** Nur zeigen, was `RunProgress` liefert — keine simulierten Fortschritte, kein Fake-Ticken während das Modell antwortet; der Herzschlag kommuniziert ehrlich „wir warten".

### Integrationspunkte

- **Nur die RunRunner-Insel auf `/runs`** — keine anderen Seiten (kein Dashboard, kein Profil, keine Result-/Compare-Ansichten).
- **Ideelle Berührung zu Inbox #7** (UI-Konzepte explorativ): die Bühne kann später als Stil-Muster für weitere Live-Elemente dienen — bewusst KEINE Kopplung, #7 bleibt eigenständig.
- **Externe Abhängigkeiten: keine.** Ausschließlich der bestehende Step-Endpoint wird konsumiert; keine neuen APIs, Services oder Libraries.

---

## Abhaengigkeiten

- Keine bestehenden Change-Ordner (alle archiviert) — keine Konflikte.
- Ideelle Überschneidung mit Inbox #7 (UI-Konzepte explorativ): bewusst entkoppelt, die Bühne kann #7 später als Stil-Muster dienen.
- Geparkter Minor „Live-Progress 0 Tokens während Steadfastness-Runden" bleibt eigenständig offen (Bühne kaschiert nur die Anzeige, fixt nicht die Zählung).

---

## Offene Punkte

- Konkrete visuelle Ausgestaltung (Zellen-Form/Größe, Herzschlag-Frequenz, Glow-Intensität) — Design-Entscheidung im Implementierungsplan bzw. per Sichtprüfung iterieren.
- Zähler-Animation: konkrete Technik (CSS-Transition vs. kleines JS-Count-up ohne rAF-Dauerloop) im Plan festlegen.
- Kleine Viewports/Mobile: Grid-Umbruch deckt das vermutlich ab — im Plan kurz verifizieren (kein eigener Breakpoint-Scope).

---

**Erstellt mit:** `/dtb:feature-discover`
