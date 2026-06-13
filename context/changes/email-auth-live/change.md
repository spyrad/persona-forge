---
change_id: email-auth-live
roadmap_id: S-01
title: "E-Mail-Auth funktioniert end-to-end"
status: implementing
created: 2026-06-13
updated: 2026-06-13
---

# Change: email-auth-live

S-01 (Stream A): Die bereits gescaffoldeten Auth-Flows (Signup, Signin, Signout,
Dashboard-Guard) werden vollständig verdrahtet und verifiziert — mit Zod-Validierung
auf den API-Routes, einem DB-Trigger für die `profiles`-Anlage und einer
Middleware-Optimierung, die den Supabase-Roundtrip auf geschützte Routen beschränkt.

Unlocks S-02 (model-config-management) und S-03 (persona-catalog).

- Roadmap: `context/foundation/roadmap.md` (S-01)
- Plan: `plan.md` / Brief: `plan-brief.md`
