# Feature Backlog

**Letzte Aktualisierung:** 2026-07-15 (Modellname-Combobox archiviert)

---

## Aktive Features

Keine aktiven Features. Starte eines mit `/dtb:feature-start`.

---

## Ideen / Backlog

| Feature                     | Status | Prio    | Datei | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------ | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-Device E-Mail-Confirm | Idee   | Niedrig | —     | PKCE-Mail-Confirm verlangt denselben Browser für Signup + Link-Klick (`code_verifier`-Cookie). Desktop-Signup + Handy-Klick → `/auth/signin?error=PKCE code verifier not found`. Gnädiger Fallback: E-Mail wird trotzdem bestätigt, User loggt sich dann normal ein. Optionale UX-Verbesserung: freundliche Meldung „E-Mail bestätigt — bitte einloggen" statt roher PKCE-Fehlertext. Entdeckt in S-01 (2026-06-15). |
| Custom SMTP (Resend)        | Idee   | Niedrig | —     | Supabase-Free-Tier-SMTP ist auf ~2–4 Mails/h limitiert → blockiert mailbasierte Auth-Tests. Eigener SMTP-Provider (z. B. Resend) entfernt das Limit.                                                                                                                                                                                                                                                                 |

---

## Abgeschlossen

Abgeschlossene Features werden archiviert und nur noch im Archiv gefuehrt:
`dtb-project/project-workflows/archive/ARCHIVE_LOG.md` (zuletzt: Modellname-Combobox, 2026-07-15).

**Fertig, noch nicht archiviert:** Keine.
