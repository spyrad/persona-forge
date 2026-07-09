-- TESTDATEI fuer die E2E-Verifikation des CI-Review-Agenten.
-- Enthaelt ABSICHTLICH Verstoesse (fehlende RLS, Sammelpolicy) und wird NIE gemergt.
create table ai_review_probe (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  note text not null
);

create policy "probe_all" on ai_review_probe for all using (true);
