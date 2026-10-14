-- À exécuter UNIQUEMENT si vous aviez déjà exécuté schema.sql avant l'ajout du live.
alter table public.registrations drop constraint if exists registrations_phone_check;
alter table public.registrations
  add constraint registrations_phone_check check (phone ~ '^\+[0-9]{7,15}$');
alter table public.registrations
  add column if not exists attendance text not null default 'onsite' check (attendance in ('onsite','online')),
  add column if not exists country text check (char_length(country) <= 80),
  add column if not exists join_group boolean not null default false;
