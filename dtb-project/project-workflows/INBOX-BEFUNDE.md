# Befund-Becken (maschinelle Verlustfunde)

> Automatisch erfasste Funde aus der Verlustpruefung (`dtb:no-loss-check` /
> `dtb:workflow-checkpoint`, Schritt 0 ohne Rueckfrage). **Kein Eintrag hier wird gearbeitet** — er muss erst
> mit `/dtb:idea-triage` befoerdert werden. Fach-Wuensche gehoeren nach `INBOX.md`, nicht hierher.

**Sichtung-Spalte:** leer = neu, noch nie gesichtet · `L1 YYYY-MM-DD` = einmal liegengelassen,
der naechste Lauf erzwingt die Entscheidung · `Altbestand` = aus der Migration uebernommen.

**„Ungesichtet" heisst: noch nicht endgueltig entschieden** — also `leer` ODER `L1 …` ODER
`Altbestand`. Diese eine Definition gilt fuer alle Zaehler (Handoff-Erinnerung des Checkpoints,
`dtb:project-health`, Abschluss-Bilanz der Triage). Entschieden ist ein Eintrag erst, wenn er das
Becken verlassen hat — befoerdert (auch als Buendel-Traeger) oder mit Archiv-Eintrag verworfen,
gebuendelt, nachgetragen oder als Lektion bzw. Fach-Frage erfasst.

**Nummernkreis:** gemeinsam mit `INBOX.md` — eine Nummer wird nie zweimal vergeben, und sie
bleibt bei der Befoerderung erhalten (Session-Logs referenzieren Nummern).

**Feld-Hygiene:** literale Pipes im Befund-Text escapen — sonst bricht die Zeile die Tabelle.

---

| #   | Datum      | Befund                                                                                                                                                                                          | Sichtung |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 12  | 2026-11-18 | Grund fuer die Entfernung von .claude/skills/ aus dem Repo (PR #22) bestaetigen und den .gitignore-Kommentar ggf. korrigieren.                                                                  |          |
| 11  | 2026-11-18 | CLAUDE.md ergaenzen: .claude/skills/ ist seit PR #22 nicht mehr versioniert — Bezugsweg der 10x-Skills (10x-cli) fuer frische Klone dokumentieren, Verweis auf /10x-e2e entsprechend einordnen. |          |
