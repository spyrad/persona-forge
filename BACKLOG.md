# Feature Backlog

**Letzte Aktualisierung:** 2026-07-19 (Live-Run-Visualisierung abgenommen — PR #16/#17 live)

---

## Aktive Features

| Feature                 | Status     | Prio   | Datei                                    | Beschreibung                                                                                                                                                                                                                             |
| ----------------------- | ---------- | ------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live-Run-Visualisierung | Abgenommen | Mittel | features/live-run-visualisierung/spec.md | Laufende Testläufe lebendig darstellen: „Live-Bühne" im Fortschritts-Panel (Zelle je Wiederholung, Herzschlag-Puls, sanft zählende Werte, Abschluss-Moment) — ruhig-konzentriert, rein darstellungsseitig, alle Lauf-Arten. Aus Idee #5. |

---

## Ideen / Backlog

| Feature                     | Status | Prio    | Datei | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------ | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-Device E-Mail-Confirm | Idee   | Niedrig | —     | PKCE-Mail-Confirm verlangt denselben Browser für Signup + Link-Klick (`code_verifier`-Cookie). Desktop-Signup + Handy-Klick → `/auth/signin?error=PKCE code verifier not found`. Gnädiger Fallback: E-Mail wird trotzdem bestätigt, User loggt sich dann normal ein. Optionale UX-Verbesserung: freundliche Meldung „E-Mail bestätigt — bitte einloggen" statt roher PKCE-Fehlertext. Entdeckt in S-01 (2026-06-15). |
| Custom SMTP (Resend)        | Idee   | Niedrig | —     | Supabase-Free-Tier-SMTP ist auf ~2–4 Mails/h limitiert → blockiert mailbasierte Auth-Tests. Eigener SMTP-Provider (z. B. Resend) entfernt das Limit.                                                                                                                                                                                                                                                                 |

---

## Abgeschlossen

Abgeschlossene Features werden archiviert und nur noch im Archiv gefuehrt:
`dtb-project/project-workflows/archive/ARCHIVE_LOG.md` (zuletzt: HEXACO-Instrument, 2026-07-18).

**Fertig, noch nicht archiviert:** Live-Run-Visualisierung (abgenommen 2026-07-19, → `/dtb:archive`).
