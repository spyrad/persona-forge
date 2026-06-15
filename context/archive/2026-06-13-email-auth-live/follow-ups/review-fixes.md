# Follow-ups aus Impl-Review (2026-06-15)

Funde aus `reviews/impl-review.md`, die NICHT in diesem Change gefixt wurden.

## F6 — Trigger-Migration idempotent machen

- **Quelle**: impl-review F6 (OBSERVATION, Data safety, LOW)
- **Datei**: `supabase/migrations/20260614174810_profiles_trigger.sql` (bereits remote applied)
- **Problem**: `handle_new_user()` inserted ohne `on conflict (id) do nothing`; bei
  zusätzlichem App-Pfad-Insert (oder Trigger-Re-Run) droht Doppel-Insert-Fehler.
  Kein `drop trigger if exists` vor `create trigger` → Re-Run scheiterte.
- **Warum deferred**: Migration ist bereits remote applied und läuft normal nur
  einmal; reiner Trigger-Pfad ist aktuell unkritisch. Nacharbeit braucht eine
  **neue** Migration (nicht die bestehende editieren).
- **Vorschlag**: Neue Migration `*_profiles_trigger_idempotent.sql`:
  `create or replace function public.handle_new_user()` mit
  `insert into public.profiles (id) values (new.id) on conflict (id) do nothing;`
  und `drop trigger if exists on_auth_user_created on auth.users;` vor dem
  `create trigger`.
