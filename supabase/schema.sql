-- Urugori rw'igisagara : à exécuter une seule fois dans Supabase > SQL Editor

create extension if not exists pgcrypto;

-- 1. Administrateurs autorisés ------------------------------------------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;  -- aucune policy : illisible depuis le navigateur

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 2. Points de départ du transport ----------------------------------------
create table if not exists public.pickup_points (
  id bigint generated always as identity primary key,
  zone text not null,        -- ex : Quartier Sud
  area text not null,        -- ex : Musaga - Gasekebuye
  name text not null,        -- ex : Kurya Mbere
  sort int not null default 0,
  active boolean not null default true
);
alter table public.pickup_points enable row level security;

create policy "points visibles par tous" on public.pickup_points
  for select to anon, authenticated using (active);
create policy "admin lit tous les points" on public.pickup_points
  for select to authenticated using (public.is_admin());
create policy "admin ajoute des points" on public.pickup_points
  for insert to authenticated with check (public.is_admin());
create policy "admin modifie les points" on public.pickup_points
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin supprime les points" on public.pickup_points
  for delete to authenticated using (public.is_admin());

insert into public.pickup_points (zone, area, name, sort) values
  ('Quartier Sud','Musaga - Gasekebuye','Kurya Gasekebuye',1),
  ('Quartier Sud','Musaga - Gasekebuye','Kurya Mbere',2),
  ('Quartier Sud','Musaga - Gasekebuye','Kurya Kabiri',3),
  ('Quartier Sud','Musaga - Gasekebuye','Kuri Zone',4),
  ('Quartier Sud','Musaga - Gasekebuye','Kw''isoko',5),
  ('Quartier Sud','Musaga - Gasekebuye','Kuri 12',6),
  ('Quartier Sud','Kanyosha - Ruziba','Kuri Dorone',7),
  ('Quartier Sud','Kanyosha - Ruziba','Petit Séminaire',8),
  ('Quartier Sud','Kanyosha - Ruziba','Kurya 2',9),
  ('Quartier Sud','Kanyosha - Ruziba','Kurya 7',10),
  ('Quartier Sud','Kanyosha - Ruziba','Kwa Sebatutsi',11),
  ('Quartier Sud','Kanyosha - Ruziba','Kurya Olympique',12),
  ('Quartier Sud','Kanyosha - Ruziba','Kuri Beb (Ruziba)',13),
  ('Quartier Nord','Gatumba - Kajaga','Gatumba - Centre',14),
  ('Quartier Nord','Gatumba - Kajaga','Kajaga (kwa Serge)',15),
  ('Quartier Nord','Kiriri','Ku bumwe',16),
  ('Quartier Nord','Kiriri','Campus Kiriri',17);

-- 3. Inscriptions ----------------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null unique check (phone ~ '^\+[0-9]{7,15}$'),
  commune text check (char_length(commune) <= 120),
  church text check (char_length(church) <= 120),
  attendance text not null default 'onsite' check (attendance in ('onsite','online')),
  country text check (char_length(country) <= 80),
  join_group boolean not null default false,  -- veut un rassemblement avec d'autres inscrites de son pays
  needs_transport text not null check (needs_transport in ('yes','no','unsure')),
  pickup_point text check (char_length(pickup_point) <= 120),
  created_at timestamptz not null default now()
);
alter table public.registrations enable row level security;

-- Tout le monde peut s'inscrire, personne d'autre que les admins ne peut lire.
create policy "inscription publique" on public.registrations
  for insert to anon, authenticated with check (true);
create policy "admin lit les inscriptions" on public.registrations
  for select to authenticated using (public.is_admin());
create policy "admin supprime les inscriptions" on public.registrations
  for delete to authenticated using (public.is_admin());

-- 4. Votre compte administrateur (remplacez l'email, puis créez ce même
--    utilisateur dans Authentication > Users)
-- insert into public.admins (email) values ('votre@email.com');
