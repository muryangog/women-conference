-- Catégories (ordinaire / clergé / personnalité), titres, provenance et présences.
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor (après schema.sql et migration-live.sql).

-- 1. Nouvelles colonnes sur les inscriptions --------------------------------
alter table public.registrations
  add column if not exists category text not null default 'ordinary'
    check (category in ('ordinary','clergy','honorary')),
  add column if not exists title text check (char_length(title) <= 80),
  add column if not exists organization text check (char_length(organization) <= 160),
  add column if not exists category_confirmed boolean not null default false,
  add column if not exists source text not null default 'web'
    check (source in ('web','app'));

-- 2. Droits : le public s'inscrit, mais seule l'équipe confirme une catégorie ----
drop policy if exists "inscription publique" on public.registrations;
create policy "inscription publique" on public.registrations
  for insert to anon, authenticated
  with check (category_confirmed = false and source = 'web');

drop policy if exists "equipe inscrit" on public.registrations;
create policy "equipe inscrit" on public.registrations
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin modifie les inscriptions" on public.registrations;
create policy "admin modifie les inscriptions" on public.registrations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Présences du jour J (une seule par inscrite) -----------------------------
create table if not exists public.check_ins (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid default auth.uid(),
  device text check (char_length(device) <= 80)
);
alter table public.check_ins enable row level security;

drop policy if exists "equipe lit les presences" on public.check_ins;
create policy "equipe lit les presences" on public.check_ins
  for select to authenticated using (public.is_admin());
drop policy if exists "equipe pointe" on public.check_ins;
create policy "equipe pointe" on public.check_ins
  for insert to authenticated with check (public.is_admin());
drop policy if exists "equipe annule un pointage" on public.check_ins;
create policy "equipe annule un pointage" on public.check_ins
  for delete to authenticated using (public.is_admin());
