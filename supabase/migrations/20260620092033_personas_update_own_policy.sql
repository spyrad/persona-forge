-- personas: UPDATE-Policy fuer den Sichtbarkeits-Toggle (S-07 visibility-controls)
-- Bisher hatte personas bewusst KEINE update-Policy (Immutability FR-008: eine
-- Aenderung entsteht nur als Kopie). S-07 erlaubt das nutzerseitige Umschalten der
-- Sichtbarkeit (privat/global) — Sichtbarkeit ist Metadaten, kein Inhalt.
-- Die Inhalts-Immutability bleibt APP-seitig erzwungen: der Service exponiert
-- ausschliesslich ein visibility-Update (updatePersonaVisibility), keine
-- Inhaltsfelder. Diese Policy oeffnet DB-seitig nur den owner-gescopten
-- Update-Pfad — exakt das Muster von runs_update_own / _rls_probe_update_own
-- ((select auth.uid()) fuer initplan-Caching, to authenticated).
create policy "personas_update_own" on public.personas
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
