-- Protection anti-spam : à exécuter SEULEMENT APRÈS avoir
--   1) ajouté SUPABASE_SERVICE_ROLE_KEY dans Vercel (Settings > Environment Variables),
--   2) redéployé le site,
--   3) vérifié qu'une inscription test fonctionne.
-- Ensuite, les inscriptions passent uniquement par le serveur du site (/api/register) :
-- plus personne ne peut remplir la base directement avec la clé publique.
drop policy if exists "inscription publique" on public.registrations;
