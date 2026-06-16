-- model_configs (S-02 model-config-management, Phase 2)
-- Erste Domaenen-Tabelle: ein angemeldeter Nutzer haengt OpenAI-kompatible
-- Modelle an (Label, Base-URL, Modellname) und legt den API-Key verschluesselt
-- ab. Folgt dem RLS-Foundation-Muster aus F-01 (_rls_probe als Vorlage):
--   * owner_id default auth.uid() (App setzt owner_id NICHT explizit)
--   * eine Policy je Operation, immer `to authenticated`
--   * `(select auth.uid())` statt nacktem auth.uid() (initplan-Caching)
--   * btree-Index auf owner_id, security invoker
-- Abweichung zu _rls_probe: KEINE visibility-Spalte — Konfigs sind immer privat
-- (owner-only), ein global geteilter Key waere ein Key-Leck ueber Nutzergrenzen.
--
-- Krypto: der API-Key liegt ausschliesslich als AES-256-GCM-Ciphertext (+ IV +
-- key_version) — app-seitig verschluesselt (src/lib/crypto.ts), nie als Klartext.
-- key_version ist Vorsorge fuer spaetere Rotation (v1 = 1, kein Rotations-Pfad).

create table public.model_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  base_url text not null,
  model_name text not null,
  key_ciphertext text not null,
  key_iv text not null,
  key_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index model_configs_owner_id_idx on public.model_configs (owner_id);

alter table public.model_configs enable row level security;

create policy "model_configs_select_own" on public.model_configs
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "model_configs_insert_own" on public.model_configs
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "model_configs_update_own" on public.model_configs
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "model_configs_delete_own" on public.model_configs
  for delete to authenticated
  using (owner_id = (select auth.uid()));
