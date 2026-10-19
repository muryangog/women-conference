-- Rôles (admin / pointeur) + places des bus.
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor (après les migrations précédentes).

-- 1. Rôles ------------------------------------------------------------------
-- admin   : tout (site /admin, badges, suppression, confirmation des catégories)
-- staff   : pointeur / accueil (application mobile : voir la liste, pointer, inscrire sur place)
alter table public.admins
  add column if not exists role text not null default 'admin' check (role in ('admin','staff'));
-- les comptes déjà présents restent « admin »

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_staff() to anon, authenticated;

-- 2. Droits : les pointeurs lisent la liste, inscrivent et pointent ; seuls les admins modifient / suppriment
drop policy if exists "admin lit les inscriptions" on public.registrations;
drop policy if exists "equipe lit les inscriptions" on public.registrations;
create policy "equipe lit les inscriptions" on public.registrations
  for select to authenticated using (public.is_staff());

drop policy if exists "equipe inscrit" on public.registrations;
create policy "equipe inscrit" on public.registrations
  for insert to authenticated with check (public.is_staff());

drop policy if exists "equipe lit les presences" on public.check_ins;
create policy "equipe lit les presences" on public.check_ins
  for select to authenticated using (public.is_staff());
drop policy if exists "equipe pointe" on public.check_ins;
create policy "equipe pointe" on public.check_ins
  for insert to authenticated with check (public.is_staff());
drop policy if exists "equipe annule un pointage" on public.check_ins;
create policy "equipe annule un pointage" on public.check_ins
  for delete to authenticated using (public.is_staff());

-- 3. Places des bus ---------------------------------------------------------
alter table public.pickup_points add column if not exists capacity int check (capacity >= 0);

-- Pour ajouter un pointeur (après avoir créé son compte dans Authentication > Users) :
-- insert into public.admins (email, role) values ('benevole@email.com', 'staff');

-- 4. Moyen d'arrivée (enregistrement sur place) ---------------------------------
-- conference_bus : bus de la conférence | church_bus : bus de l'église | own : par ses propres moyens
alter table public.registrations
  add column if not exists arrival_mode text check (arrival_mode in ('conference_bus','church_bus','own'));
