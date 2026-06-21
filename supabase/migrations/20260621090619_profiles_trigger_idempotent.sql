-- profiles-Trigger idempotent machen (Follow-up F6 aus S-01 email-auth-live)
-- Quelle: impl-review F6 (OBSERVATION, Data safety, LOW).
--
-- Ergaenzt 20260614174810_profiles_trigger.sql (remote bereits appliziert, daher
-- NICHT editiert, sondern hier neu nachgezogen):
--   1. `on conflict (id) do nothing` — ein zweiter profiles-Insert-Pfad (App,
--      Admin, OAuth) oder ein Trigger-Re-Run loest keinen Doppel-Insert-Fehler
--      mehr aus.
--   2. `drop trigger if exists` vor `create trigger` — die Migration ist selbst
--      idempotent (Re-Run scheitert nicht an einem bereits existierenden Trigger).
--
-- security definer + leerer search_path bleiben unveraendert (search_path-Schutz).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
