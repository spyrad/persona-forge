-- profiles-Trigger (S-01 email-auth-live, Phase 2)
-- Haelt public.profiles konsistent mit auth.users: bei jedem neuen User-Eintrag
-- wird automatisch eine profiles-Zeile angelegt — unabhaengig vom Pfad (App,
-- Admin, OAuth spaeter). Ergaenzt das RLS-Foundation-Muster aus F-01.
--
-- security definer + leerer search_path: Auth-Triggers laufen mit erhoehten
-- Rechten; explizites search_path = '' und schema-qualifizierte Namen
-- (public.profiles) verhindern search_path-Injection.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
