---
change_id: oejts-measurement-run
title: OEJTS-Messlauf mit N Wiederholungen ausführen
status: implementing
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

Roadmap-Slice **S-04** (`context/foundation/roadmap.md`), der Methodenkern (Stream B,
Leitstern). PRD-Refs: US-01, FR-010, FR-012, FR-013 + NFR Lauf-Resilienz/Last/Fortschritt.

- **Instrument liegt bereit:** `context/foundation/instruments/oejts-1.2.json` — 32 Items,
  4 Achsen (IE/SN/FT/JP), Scoring-Formeln + Cutoff >24, Lizenz CC BY-NC-SA 4.0 (privat/MVP OK).
- **Prerequisites erfüllt:** S-02 (Modellkonfig, Key verschlüsselt) + S-03 (Persona-Katalog) sind live.
- **Outcome:** Instrument wählen → N setzen → Lauf starten; jede Wiederholung in isolierter Sitzung
  mit Item-Permutation; Antworten strukturiert geparst (JSON + Freitext-Fallback), je Item/Wiederholung
  roh gespeichert; Fortschritt sichtbar; einzelne Fehlantworten brechen den Lauf nicht ab.
- **Offene Unbekannte (kein Blocker, für `/10x-plan`-Research):** Cloudflare-Edge-Runtime begrenzt
  lang laufende Tasks → Lauf-Aufteilung oder Queues/Workers. Außerdem: robustes Antwort-Parsing
  (JSON mit Freitext-Fallback) gegen reale LLM-Endpunkte.
- Auswertung/Anzeige der Verteilung je Achse ist **S-05**, nicht hier.
