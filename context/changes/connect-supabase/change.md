---
change_id: connect-supabase
roadmap_id: F-01
title: "Supabase-Projekt anbinden + RLS-Grundgerüst"
status: impl_reviewed
created: 2026-06-12
updated: 2026-06-12
---

# Change: connect-supabase

F-01 (Foundation, Stream A): Ein Supabase-Projekt ist angelegt und mit der App
verbunden (`.env`/`.dev.vars` lokal, Secrets in CI + Worker); das
Datenzugriffs-Grundgerüst (Nutzer sieht nur Eigenes + Globales, per Row Level
Security) ist als Contract etabliert — nicht das fertige Schema, nur der
minimale Anker, an den Slices ihre Tabellen hängen.

Unlocks S-01 (email-auth-live) und transitiv alle weiteren Slices.

- Roadmap: `context/foundation/roadmap.md` (F-01)
- Research: `research.md`
- Plan: `plan.md` / Brief: `plan-brief.md`
