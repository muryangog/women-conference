"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, type PickupPoint } from "@/lib/supabase";
import { CATEGORY_LABELS, COUNTRIES, EVENT, TITLE_SUGGESTIONS, dialCode, normalizePhone, type Attendance, type Category, type Transport } from "@/lib/config";

type Done = { ref: string; name: string; online: boolean; country: string; transport: string; pickup: string; group: boolean; category: Category };

const up = (s: string) => s.trim().toUpperCase();

export default function RegistrationForm() {
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [attendance, setAttendance] = useState<Attendance>("onsite");
  const [country, setCountry] = useState("");
  const [joinGroup, setJoinGroup] = useState(false);
  const [category, setCategory] = useState<Category>("ordinary");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("");
  const [church, setChurch] = useState("");
  const [transport, setTransport] = useState<Transport | "">("");
  const [pickup, setPickup] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const online = attendance === "online";
  const phoneCountry = online ? country : "Burundi";

  useEffect(() => {
    supabase.from("pickup_points").select("*").order("sort")
      .then(({ data }) => setPoints((data as PickupPoint[]) ?? []));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, PickupPoint[]>>();
    points.forEach((p) => {
      const z = map.get(p.zone) ?? new Map<string, PickupPoint[]>();
      z.set(p.area, [...(z.get(p.area) ?? []), p]);
      map.set(p.zone, z);
    });
    return map;
  }, [points]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = fullName.trim();
    if (name.length < 2) return setError("Écris ton nom complet.");
    if (category !== "ordinary") {
      if (!title.trim()) return setError("Indique ton titre (ex : Pasteure, Honorable).");
      if (!organization.trim()) return setError("Indique ton association, ton institution ou ton lieu de provenance.");
    }
    if (online && !country) return setError("Choisis ton pays.");

    const normalized = normalizePhone(phone, phoneCountry);
    if (!normalized) {
      return setError(
        !online
          ? "Numéro invalide : 8 chiffres, par exemple 79 123 456."
          : "Numéro invalide. Écris-le avec l'indicatif (ex : +33 6 12 34 56 78) ou sans."
      );
    }
    if (!online) {
      if (!transport) return setError("Indique si tu as besoin du transport.");
      if (transport === "yes" && !pickup) return setError("Choisis ton point de départ.");
    }

    setBusy(true);
    const id = crypto.randomUUID();
    const { error: err } = await supabase.from("registrations").insert({
      id,
      full_name: up(name),
      phone: normalized,
      commune: up(commune) || null,
      church: category === "ordinary" ? up(church) || null : null,
      category,
      title: category === "ordinary" ? null : up(title),
      organization: category === "ordinary" ? null : up(organization),
      attendance,
      country: online ? country : "Burundi",
      join_group: online ? joinGroup : false,
      needs_transport: online ? "no" : transport,
      pickup_point: !online && transport === "yes" ? pickup : null,
    });
    setBusy(false);

    if (err) {
      if (err.code === "23505") return setError("Ce numéro est déjà inscrit : ta place est réservée.");
      return setError("L'inscription n'a pas abouti. Vérifie ta connexion et réessaie.");
    }
    setDone({ ref: id.slice(0, 6).toUpperCase(), name, online, country, transport, pickup, group: joinGroup, category });
  }

  function reset() {
    setDone(null); setFullName(""); setPhone(""); setCommune(""); setChurch("");
    setTransport(""); setPickup(""); setJoinGroup(false); setError("");
    setCategory("ordinary"); setTitle(""); setOrganization("");
  }

  /* ---------------- confirmation (sur la même page) ---------------- */
  if (done) {
    return (
      <div className="space-y-4 py-2 text-center sm:py-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose text-2xl text-creme">✓</div>
        <div>
          <h2 className="font-display text-3xl font-semibold">Merci {done.name.split(" ")[0]} !</h2>
          <p className="mt-1 text-sm text-bordeaux/75">Ton inscription est confirmée.</p>
        </div>
        <p className="mx-auto inline-block rounded-xl bg-bordeaux px-5 py-2 font-display text-3xl font-bold tracking-wider text-creme">{done.ref}</p>
        <ul className="space-y-1 text-left text-sm">
          <li><b>Quand :</b> {EVENT.dateLabel}, {EVENT.time} (heure de Bujumbura)</li>
          {done.category !== "ordinary" && (
            <li><b>Accueil :</b> l&apos;équipe du protocole vérifiera ta qualité ({CATEGORY_LABELS[done.category]}) et te contactera si besoin.</li>
          )}
          {done.online ? (
            <>
              <li><b>Participation :</b> en direct, en ligne · {done.country}</li>
              <li>
                <b>Le live :</b>{" "}
                {EVENT.liveLink
                  ? <a className="underline" href={EVENT.liveLink}>ouvrir le lien</a>
                  : "le lien te sera envoyé sur WhatsApp avant la conférence."}
              </li>
              {done.group && <li><b>Rassemblement :</b> l&apos;équipe te contactera pour te mettre en lien avec d&apos;autres femmes de ton pays.</li>}
            </>
          ) : (
            <>
              <li><b>Lieu :</b> {EVENT.place} · {EVENT.placeDetail}</li>
              {done.transport === "yes" && <li><b>Départ du bus :</b> {done.pickup}</li>}
              {done.transport === "unsure" && <li><b>Transport :</b> écris-nous sur WhatsApp quand tu seras décidée.</li>}
            </>
          )}
        </ul>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <a href={EVENT.whatsappLink} className="btn btn-rose px-5 py-2.5 text-sm">WhatsApp</a>
          <button onClick={reset} className="btn border border-bordeaux/25 px-5 py-2.5 text-sm text-bordeaux hover:bg-bordeaux/5">Inscrire une autre personne</button>
        </div>
      </div>
    );
  }

  /* ---------------- formulaire ---------------- */
  return (
    <form onSubmit={onSubmit} className="space-y-2.5 sm:space-y-3" noValidate>
      <h1 className="font-display text-2xl font-semibold leading-none sm:text-3xl">Inscrivez-vous</h1>

      <div role="radiogroup" aria-label="Mode de participation" className="seg grid-cols-2">
        {([["onsite", "Sur place"], ["online", "En ligne (live)"]] as [Attendance, string][]).map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="attendance" checked={attendance === v} onChange={() => setAttendance(v)} />
            {l}
          </label>
        ))}
      </div>

      {category === "ordinary" ? (
        <button type="button" onClick={() => setCategory("clergy")}
          className="-mt-1 text-left text-xs font-semibold text-rose-deep underline underline-offset-2">
          Pasteur(e), évêque ou personnalité invitée ?
        </button>
      ) : (
        <div role="radiogroup" aria-label="Catégorie" className="seg grid-cols-3">
          {([["ordinary", "Ordinaire"], ["clergy", "Clergé"], ["honorary", "Personnalité"]] as [Category, string][]).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="category" checked={category === v} onChange={() => setCategory(v)} />
              {l}
            </label>
          ))}
        </div>
      )}

      {online && (
        <div>
          <label htmlFor="country" className="label">Ton pays *</label>
          <select id="country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Choisis ton pays</option>
            {COUNTRIES.map(([n]) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <div>
          <label htmlFor="name" className="label">Nom complet *</label>
          <input id="name" className="field uppercase" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="phone" className="label">Téléphone *</label>
          <div className="flex gap-1.5">
            {phoneCountry && dialCode(phoneCountry) && (
              <span className="flex items-center rounded-xl bg-bordeaux/[.07] px-2.5 text-sm font-semibold">+{dialCode(phoneCountry)}</span>
            )}
            <input id="phone" className="field min-w-0" type="tel" inputMode="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder={online ? "Ton numéro" : "79 123 456"} />
          </div>
        </div>
      </div>

      {category !== "ordinary" && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div>
            <label htmlFor="title" className="label">Titre *</label>
            <input id="title" list="titles" className="field uppercase" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pasteure, Honorable…" />
            <datalist id="titles">{TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
          </div>
          <div>
            <label htmlFor="org" className="label">Association / provenance *</label>
            <input id="org" className="field uppercase" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Église, institution, lieu" />
          </div>
        </div>
      )}

      <div className={category === "ordinary" ? "grid grid-cols-2 gap-3" : ""}>
        <div>
          <label htmlFor="commune" className="label">{online ? "Ville" : "Commune / quartier"}</label>
          <input id="commune" className="field uppercase" value={commune} onChange={(e) => setCommune(e.target.value)} />
        </div>
        {category === "ordinary" && (
          <div>
            <label htmlFor="church" className="label">Nom de votre église</label>
            <input id="church" className="field uppercase" value={church} onChange={(e) => setChurch(e.target.value)} />
          </div>
        )}
      </div>

      {online ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-bordeaux/[.05] px-3.5 py-2.5">
          <input type="checkbox" checked={joinGroup} onChange={(e) => setJoinGroup(e.target.checked)} className="mt-1 h-4 w-4 accent-rose" />
          <span className="text-sm leading-snug">
            <b>Je veux suivre le live avec d&apos;autres femmes de mon pays</b>
            <span className="block text-xs text-bordeaux/65">L&apos;équipe te contactera pour organiser un rassemblement.</span>
          </span>
        </label>
      ) : (
        <>
          <div>
            <span className="label">Transport organisé ? *</span>
            <div role="radiogroup" aria-label="Transport" className="seg grid-cols-3">
              {([["yes", "Oui"], ["no", "Non"], ["unsure", "Peut-être"]] as [Transport, string][]).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="transport" checked={transport === v} onChange={() => setTransport(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {transport === "yes" && (
            <div>
              <label htmlFor="pickup" className="label">Point de départ *</label>
              <select id="pickup" className="field" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                <option value="">Choisis un point de départ</option>
                {[...grouped].map(([zone, areas]) =>
                  [...areas].map(([area, pts]) => (
                    <optgroup key={`${zone}-${area}`} label={`${zone} · ${area}`}>
                      {pts.map((p) => <option key={p.id} value={`${p.zone} · ${p.name}`}>{p.name}</option>)}
                    </optgroup>
                  ))
                )}
              </select>
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="rounded-xl bg-rose/10 px-3.5 py-2 text-sm font-medium text-rose-deep">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-rose w-full">
        {busy ? "Enregistrement…" : "Confirmer mon inscription"}
      </button>
    </form>
  );
}
