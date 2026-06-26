# Follow-ups aus Impl-Review (sentry-monitoring)

## F3 — ENCRYPTION_KEY nicht im Deploy-Secret-Sync (vorbestehend, out-of-scope)

- **Quelle:** `context/changes/sentry-monitoring/reviews/impl-review.md` (F3)
- **Ort:** `.github/workflows/ci.yml:80-83` (`secrets:`-Block der wrangler-action)
- **Befund:** Der `secrets:`-Sync deckt nur `SUPABASE_URL`, `SUPABASE_KEY`, `SENTRY_DSN` ab —
  **nicht** `ENCRYPTION_KEY` (für die API-Key-Verschlüsselung). Nicht von diesem Change
  eingeführt; beim Review aufgefallen. Prod läuft → der Key ist als Worker-Secret gesetzt,
  vermutlich manuell via `wrangler secret put` (nicht über den GitHub-Secrets-Sync).
- **Warum zurückgestellt:** Gehört nicht zu sentry-monitoring (Scope-Disziplin). Zudem
  riskant, `ENCRYPTION_KEY` blind in den Sync-Block aufzunehmen: existiert das GitHub-Secret
  nicht, würde der nächste Deploy ein leeres Secret pushen und die Entschlüsselung in Prod
  brechen.
- **Nächster Schritt (separater Change):**
  1. Verifizieren, ob `ENCRYPTION_KEY` als Worker-Secret gesetzt ist
     (`wrangler secret list` bzw. Cloudflare-Dashboard).
  2. Verifizieren, ob ein GitHub-Repo-Secret `ENCRYPTION_KEY` existiert.
  3. Erst wenn (2) bestätigt: `ENCRYPTION_KEY` in den `secrets:`-Block + als `env:` der
     wrangler-action ergänzen, damit die Single-Source-of-Truth-Regel (GitHub-Secrets)
     auch für diesen Key gilt — analog zu `SUPABASE_*`/`SENTRY_DSN`.
