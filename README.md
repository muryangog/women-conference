# Urugori rw'igisagara — plateforme d'inscription

Next.js 14 + Tailwind + Supabase.

## 1. Supabase (5 min)
1. Créez un projet sur https://supabase.com
2. SQL Editor : collez et exécutez `supabase/schema.sql`
3. Authentication > Users > Add user : créez votre compte (email + mot de passe)
4. Authentication > Sign In / Providers : désactivez « Allow new users to sign up »
5. SQL Editor : `insert into public.admins (email) values ('votre@email.com');`
6. Project Settings > API : copiez l'URL et la clé `anon` (jamais la clé `service_role`)

Si tu avais déjà exécuté `schema.sql` avant l'ajout du live en ligne, exécute `supabase/migration-live.sql`.

## 2. En local
```bash
cp .env.example .env.local   # collez l'URL et la clé anon
npm install
npm run dev
```
Pages : `/` (présentation + inscription + confirmation sur un seul écran) · `/admin`

## 3. Mise en ligne (Vercel)
Importez le dépôt sur vercel.com, ajoutez les deux variables d'environnement, déployez.
Générez ensuite un QR code vers l'adresse du site pour les flyers.

## Live
Colle le lien du live dans `liveLink` (`lib/config.ts`) : il s'affiche sur la confirmation des inscrites en ligne.
Dans `/admin`, filtre « En ligne » + le tableau « En ligne, par pays » te donnent les groupes à constituer.

## Personnalisation
- Textes, date, intervenants : `lib/config.ts`
- Points de départ : page `/admin` > « Points de départ »
- Couleurs : `tailwind.config.ts`
