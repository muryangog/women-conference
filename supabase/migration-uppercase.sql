-- Met en MAJUSCULES tout ce qui est saisi (nom, commune, église, titre, association),
-- que l'inscription vienne du site ou de l'application mobile.
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor.

create or replace function public.upper_registration_fields()
returns trigger
language plpgsql
as $$
begin
  new.full_name    := upper(btrim(new.full_name));
  new.commune      := nullif(upper(btrim(new.commune)), '');
  new.church       := nullif(upper(btrim(new.church)), '');
  new.title        := nullif(upper(btrim(new.title)), '');
  new.organization := nullif(upper(btrim(new.organization)), '');
  return new;
end;
$$;

drop trigger if exists trg_upper_registration on public.registrations;
create trigger trg_upper_registration
  before insert or update on public.registrations
  for each row execute function public.upper_registration_fields();

-- Met aussi en majuscules les inscriptions déjà enregistrées
update public.registrations set full_name = full_name;
