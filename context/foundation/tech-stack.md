---
starter_id: 10x-astro-starter
package_manager: npm
project_name: persona-forge
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: true
---

## Why this stack

Solo-Entwickler, 7 Wochen after-hours, Web-App mit Auth, LLM-Anbindung und
persistenten Läufen — das verlangt einen battle-tested, agent-freundlichen
Starter, der Auth + Datenbank + Deploy out of the box mitbringt. Der 10x Astro
Starter (Astro + React + TypeScript + Supabase + Cloudflare) ist der empfohlene
Default für `(web, js)`, besteht alle vier Agent-Friendly-Gates und deckt
FR-001 (E-Mail+Passwort-Auth via Supabase) und die Persistenz (Postgres) direkt
ab. Bekannter Reibungspunkt, bewusst akzeptiert: Die Cloudflare-Edge-Runtime
begrenzt lang laufende Tasks — die Testläufe mit N Wiederholungen (FR-012,
FR-014) brauchen daher im Implementierungsplan eine Lauf-Aufteilung oder
Cloudflare Queues/Workers; `has_background_jobs: true` signalisiert das dem
Bootstrapper. Scaffolding-Verlässlichkeit ist first-class (registriert, nicht
end-to-end battle-tested) — gelegentliche manuelle Schritte sind möglich. CI
läuft auf GitHub Actions mit Auto-Deploy bei Merge auf main, passend zum
bestehenden Repo spyrad/persona-forge.
