-- personas: Sichtbarkeits-Default auf 'private' (impl-review F1, S-03)
-- Defense-in-Depth: nutzerangelegte Personas sollen privat sein. Die App setzt
-- visibility beim Insert bereits explizit auf 'private' (createPersona); dieser
-- geaenderte Spalten-Default schuetzt zusaetzlich rohe/direkte DB-Inserts.
-- Globale Personas entstehen ausschliesslich per Seed/Migration mit explizitem
-- visibility = 'global' (FR-009). Bestehende Zeilen bleiben unveraendert
-- (set default beruehrt keine vorhandenen Werte).
alter table public.personas alter column visibility set default 'private';
