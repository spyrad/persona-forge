# Feature Backlog

**Letzte Aktualisierung:** 2026-07-14

---

## Aktive Features

| Feature       | Status            | Prio | Datei                                                        | Ziel                                                                                                                                                                               |
| ------------- | ----------------- | ---- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model Compare | Fertig zum Testen | Hoch | dtb-project/project-workflows/features/model-compare/spec.md | Test-Ergebnisse pro Modell aggregieren (Profil je Instrument, nur Baseline-Läufe ohne Persona) und 2–4 Modelle nebeneinander vergleichen; instrument-agnostisch für künftige Tests |

---

## Ideen / Backlog

| Feature                     | Status | Prio    | Datei | Beschreibung                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ------ | ------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-Device E-Mail-Confirm | Idee   | Niedrig | —     | PKCE-Mail-Confirm verlangt denselben Browser für Signup + Link-Klick (`code_verifier`-Cookie). Desktop-Signup + Handy-Klick → `/auth/signin?error=PKCE code verifier not found`. Gnädiger Fallback: E-Mail wird trotzdem bestätigt, User loggt sich dann normal ein. Optionale UX-Verbesserung: freundliche Meldung „E-Mail bestätigt — bitte einloggen" statt roher PKCE-Fehlertext. Entdeckt in S-01 (2026-06-15). |
| Custom SMTP (Resend)        | Idee   | Niedrig | —     | Supabase-Free-Tier-SMTP ist auf ~2–4 Mails/h limitiert → blockiert mailbasierte Auth-Tests. Eigener SMTP-Provider (z. B. Resend) entfernt das Limit.                                                                                                                                                                                                                                                                 |

---

## Abgeschlossen

| Feature | Abgeschlossen | Datei |
| ------- | ------------- | ----- |
