"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Qr from "@/components/Qr";
import Turnstile from "@/components/Turnstile";
import { qrPayload } from "@/lib/qr";
import { supabase, type PickupPoint } from "@/lib/supabase";
import { COUNTRIES, EVENT, TITLE_SUGGESTIONS, dialCode, normalizePhone, type Attendance, type Category, type Transport } from "@/lib/config";

type Done = { id: string; ref: string; name: string; online: boolean; country: string; transport: string; pickup: string; group: boolean; category: Category };
type Lang = "fr" | "en";

const DICT = {
  fr: {
    title: "Inscrivez-vous",
    onsite: "Sur place",
    online: "En ligne (live)",
    vipPrompt: "Pasteur(e), évêque ou personnalité invitée ?",
    ordinary: "Ordinaire",
    clergy: "Clergé",
    honorary: "Personnalité",
    countryLabel: "Ton pays *",
    chooseCountry: "Choisis ton pays",
    nameLabel: "Nom complet *",
    phoneLabel: "Téléphone",
    phonePlaceholderOnline: "Ton numéro",
    phonePlaceholderLocal: "79 123 456",
    titleLabel: "Titre *",
    titlePlaceholder: "Pasteure, Honorable…",
    orgLabel: "Association / provenance *",
    orgPlaceholder: "Église, institution, lieu",
    communeLabelOnline: "Ville",
    communeLabelLocal: "Commune / quartier",
    churchLabel: "Nom de votre église",
    joinGroupTitle: "Je veux suivre le live avec d'autres femmes de mon pays",
    joinGroupSub: "L'équipe te contactera pour organiser un rassemblement.",
    transportQuestion: "Transport organisé ? *",
    transportYes: "Oui",
    transportNo: "Non",
    transportUnsure: "Peut-être",
    pickupLabel: "Point de départ *",
    choosePickup: "Choisis un point de départ",
    submitBtn: "Confirmer mon inscription",
    submitting: "Enregistrement…",
    nameRequired: "Écris ton nom complet.",
    titleRequired: "Indique ton titre (ex : Pasteure, Honorable).",
    orgRequired: "Indique ton association, ton institution ou ton lieu de provenance.",
    countryRequired: "Choisis ton pays.",
    invalidPhoneBurundi: "Numéro invalide : 8 chiffres, par exemple 79 123 456.",
    invalidPhoneIntl: "Numéro invalide. Écris-le avec l'indicatif (ex : +33 6 12 34 56 78) ou sans.",
    transportRequired: "Indique si tu as besoin du transport.",
    pickupRequired: "Choisis ton point de départ.",
    alreadyRegistered: "Ce numéro est déjà inscrit : ta place est réservée.",
    netError: "Connexion impossible. Vérifie ton réseau et réessaie.",
    genericError: "L'inscription n'a pas abouti. Vérifie ta connexion et réessaie.",
    turnstileWait: "Vérification en cours, réessaie dans un instant.",
    thankYou: "Merci",
    confirmed: "Ton inscription est confirmée.",
    presentQr: "Présente ce code à l'entrée. Fais-en une capture d'écran.",
    when: "Quand :",
    whenDetail: "heure de Bujumbura",
    vipNotice: "Accueil : l'équipe du protocole vérifiera ta qualité",
    vipNoticeEnd: "et te contactera si besoin.",
    participation: "Participation :",
    participationOnline: "en direct, en ligne",
    liveStream: "Le live :",
    openLink: "ouvrir le lien",
    liveNotice: "le lien te sera envoyé sur WhatsApp avant la conférence.",
    gathering: "Rassemblement : l'équipe te contactera pour te mettre en lien avec d'autres femmes de ton pays.",
    location: "Lieu :",
    busDepart: "Départ du bus :",
    transportDecide: "Transport : écris-nous sur WhatsApp quand tu seras décidée.",
    registerAnother: "Inscrire une autre personne",
  },
  en: {
    title: "Register",
    onsite: "On-site",
    online: "Online (live)",
    vipPrompt: "Pastor, bishop or invited guest?",
    ordinary: "General",
    clergy: "Clergy",
    honorary: "VIP / Dignitary",
    countryLabel: "Your country *",
    chooseCountry: "Select your country",
    nameLabel: "Full name *",
    phoneLabel: "Phone number",
    phonePlaceholderOnline: "Your phone number",
    phonePlaceholderLocal: "79 123 456",
    titleLabel: "Title *",
    titlePlaceholder: "Pastor, Honorable…",
    orgLabel: "Association / Organization *",
    orgPlaceholder: "Church, institution, place of origin",
    communeLabelOnline: "City",
    communeLabelLocal: "Municipality / Area",
    churchLabel: "Church name",
    joinGroupTitle: "I want to watch the live stream with other women in my country",
    joinGroupSub: "The team will contact you to organize a local gathering.",
    transportQuestion: "Organized transport? *",
    transportYes: "Yes",
    transportNo: "No",
    transportUnsure: "Not sure yet",
    pickupLabel: "Pickup point *",
    choosePickup: "Select a pickup location",
    submitBtn: "Confirm my registration",
    submitting: "Registering…",
    nameRequired: "Please enter your full name.",
    titleRequired: "Please indicate your title (e.g. Pastor, Honorable).",
    orgRequired: "Please indicate your church, organization or place of origin.",
    countryRequired: "Please select your country.",
    invalidPhoneBurundi: "Invalid number: 8 digits, e.g. 79 123 456.",
    invalidPhoneIntl: "Invalid phone number. Include country code (e.g. +1 555 123 4567) or digits.",
    transportRequired: "Please indicate if you need transportation.",
    pickupRequired: "Please choose a pickup location.",
    alreadyRegistered: "This phone number is already registered: your place is saved.",
    netError: "Connection error. Please check your network and try again.",
    genericError: "Registration could not be completed. Please check your connection and try again.",
    turnstileWait: "Verification in progress, please try again in a moment.",
    thankYou: "Thank you",
    confirmed: "Your registration is confirmed.",
    presentQr: "Show this code at the entrance. Take a screenshot.",
    when: "When:",
    whenDetail: "Bujumbura time",
    vipNotice: "Protocol welcome: our team will verify your accreditation",
    vipNoticeEnd: "and contact you if needed.",
    participation: "Attendance:",
    participationOnline: "Live stream online",
    liveStream: "Live link:",
    openLink: "open link",
    liveNotice: "the link will be sent to you via WhatsApp prior to the conference.",
    gathering: "Gathering: our team will contact you to connect you with other women in your country.",
    location: "Location:",
    busDepart: "Bus pickup point:",
    transportDecide: "Transportation: reach out to us on WhatsApp when you have decided.",
    registerAnother: "Register another person",
  },
};

const up = (s: string) => s.trim().toUpperCase();

export default function RegistrationForm() {
  const [lang, setLang] = useState<Lang>("fr");
  const t = DICT[lang];

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
  const [honeypot, setHoneypot] = useState("");
  const [token, setToken] = useState("");
  const [resetSignal, setResetSignal] = useState(0);
  const onToken = useCallback((tok: string) => setToken(tok), []);
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
    if (name.length < 2) return setError(t.nameRequired);
    if (category !== "ordinary") {
      if (!title.trim()) return setError(t.titleRequired);
      if (!organization.trim()) return setError(t.orgRequired);
    }
    if (online && !country) return setError(t.countryRequired);

    let normalized = "";
    if (phone.trim()) {
      const norm = normalizePhone(phone, phoneCountry);
      if (!norm) {
        return setError(!online ? t.invalidPhoneBurundi : t.invalidPhoneIntl);
      }
      normalized = norm;
    }

    if (!online) {
      if (!transport) return setError(t.transportRequired);
      if (transport === "yes" && !pickup) return setError(t.pickupRequired);
    }

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !token) {
      return setError(t.turnstileWait);
    }

    setBusy(true);
    const id = crypto.randomUUID();
    let res: Response;
    try {
      res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          website: honeypot,
          turnstile: token,
          full_name: up(name),
          phone: normalized,
          commune: up(commune),
          church: category === "ordinary" ? up(church) : "",
          category,
          title: category === "ordinary" ? "" : up(title),
          organization: category === "ordinary" ? "" : up(organization),
          attendance,
          country: online ? country : "Burundi",
          join_group: online ? joinGroup : false,
          needs_transport: online ? "no" : transport,
          pickup_point: !online && transport === "yes" ? pickup : "",
        }),
      });
    } catch {
      setBusy(false);
      return setError(t.netError);
    }
    setBusy(false);

    if (!res.ok) {
      setResetSignal((n) => n + 1);
      if (res.status === 409) return setError(t.alreadyRegistered);
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      return setError(j?.error ?? t.genericError);
    }
    setDone({ id, ref: id.slice(0, 6).toUpperCase(), name, online, country, transport, pickup, group: joinGroup, category });
  }

  function reset() {
    setDone(null); setFullName(""); setPhone(""); setCommune(""); setChurch("");
    setTransport(""); setPickup(""); setJoinGroup(false); setError("");
    setCategory("ordinary"); setTitle(""); setOrganization("");
  }

  /* ---------------- confirmation (sur la même page) ---------------- */
  if (done) {
    const catLabel = category === "clergy" ? t.clergy : category === "honorary" ? t.honorary : t.ordinary;
    return (
      <div className="space-y-4 py-2 text-center sm:py-4">
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-lg bg-bordeaux/10 p-0.5 text-xs font-bold">
            <button type="button" onClick={() => setLang("fr")} className={`px-2.5 py-1 rounded-md transition-colors ${lang === "fr" ? "bg-white text-bordeaux shadow-sm" : "text-bordeaux/60"}`}>FR</button>
            <button type="button" onClick={() => setLang("en")} className={`px-2.5 py-1 rounded-md transition-colors ${lang === "en" ? "bg-white text-bordeaux shadow-sm" : "text-bordeaux/60"}`}>EN</button>
          </div>
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose text-2xl text-creme">✓</div>
        <div>
          <h2 className="font-display text-3xl font-semibold">{t.thankYou} {done.name.split(" ")[0]} !</h2>
          <p className="mt-1 text-sm text-bordeaux/75">{t.confirmed}</p>
        </div>
        <p className="mx-auto inline-block rounded-xl bg-bordeaux px-5 py-2 font-display text-3xl font-bold tracking-wider text-creme">{done.ref}</p>
        {!done.online && (
          <div>
            <div className="mx-auto w-fit rounded-2xl border border-bordeaux/15 bg-white p-2"><Qr value={qrPayload(done.id)} size={150} /></div>
            <p className="mt-1 text-xs text-bordeaux/70">{t.presentQr}</p>
          </div>
        )}
        <ul className="space-y-1 text-left text-sm">
          <li><b>{t.when}</b> {EVENT.dateLabel}, {EVENT.time} ({t.whenDetail})</li>
          {done.category !== "ordinary" && (
            <li><b>{t.vipNotice}</b> ({catLabel}) {t.vipNoticeEnd}</li>
          )}
          {done.online ? (
            <>
              <li><b>{t.participation}</b> {t.participationOnline} · {done.country}</li>
              <li>
                <b>{t.liveStream}</b>{" "}
                {EVENT.liveLink
                  ? <a className="underline" href={EVENT.liveLink}>{t.openLink}</a>
                  : t.liveNotice}
              </li>
              {done.group && <li><b>{t.gathering}</b></li>}
            </>
          ) : (
            <>
              <li><b>{t.location}</b> {EVENT.place} · {EVENT.placeDetail}</li>
              {done.transport === "yes" && <li><b>{t.busDepart}</b> {done.pickup}</li>}
              {done.transport === "unsure" && <li><b>{t.transportDecide}</b></li>}
            </>
          )}
        </ul>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <a href={EVENT.whatsappLink} className="btn btn-rose px-5 py-2.5 text-sm">WhatsApp</a>
          <button onClick={reset} className="btn border border-bordeaux/25 px-5 py-2.5 text-sm text-bordeaux hover:bg-bordeaux/5">{t.registerAnother}</button>
        </div>
      </div>
    );
  }

  /* ---------------- formulaire ---------------- */
  return (
    <form onSubmit={onSubmit} className="space-y-2.5 sm:space-y-3" noValidate>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold leading-none sm:text-3xl">{t.title}</h1>
        <div className="inline-flex rounded-lg bg-bordeaux/10 p-0.5 text-xs font-bold">
          <button type="button" onClick={() => setLang("fr")} className={`px-2.5 py-1 rounded-md transition-colors ${lang === "fr" ? "bg-white text-bordeaux shadow-sm" : "text-bordeaux/60"}`}>FR</button>
          <button type="button" onClick={() => setLang("en")} className={`px-2.5 py-1 rounded-md transition-colors ${lang === "en" ? "bg-white text-bordeaux shadow-sm" : "text-bordeaux/60"}`}>EN</button>
        </div>
      </div>

      <div role="radiogroup" aria-label="Mode de participation" className="seg grid-cols-2">
        {([["onsite", t.onsite], ["online", t.online]] as [Attendance, string][]).map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="attendance" checked={attendance === v} onChange={() => setAttendance(v)} />
            {l}
          </label>
        ))}
      </div>

      {category === "ordinary" ? (
        <button type="button" onClick={() => setCategory("clergy")}
          className="-mt-1 text-left text-xs font-semibold text-rose-deep underline underline-offset-2">
          {t.vipPrompt}
        </button>
      ) : (
        <div role="radiogroup" aria-label="Catégorie" className="seg grid-cols-3">
          {([["ordinary", t.ordinary], ["clergy", t.clergy], ["honorary", t.honorary]] as [Category, string][]).map(([v, l]) => (
            <label key={v}>
              <input type="radio" name="category" checked={category === v} onChange={() => setCategory(v)} />
              {l}
            </label>
          ))}
        </div>
      )}

      {online && (
        <div>
          <label htmlFor="country" className="label">{t.countryLabel}</label>
          <select id="country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">{t.chooseCountry}</option>
            {COUNTRIES.map(([n]) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        <div>
          <label htmlFor="name" className="label">{t.nameLabel}</label>
          <input id="name" className="field uppercase" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="phone" className="label">{t.phoneLabel}</label>
          <div className="flex gap-1.5">
            {phoneCountry && dialCode(phoneCountry) && (
              <span className="flex items-center rounded-xl bg-bordeaux/[.07] px-2.5 text-sm font-semibold">+{dialCode(phoneCountry)}</span>
            )}
            <input id="phone" className="field min-w-0" type="tel" inputMode="tel" autoComplete="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} placeholder={online ? t.phonePlaceholderOnline : t.phonePlaceholderLocal} />
          </div>
        </div>
      </div>

      {category !== "ordinary" && (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div>
            <label htmlFor="title" className="label">{t.titleLabel}</label>
            <input id="title" list="titles" className="field uppercase" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} />
            <datalist id="titles">{TITLE_SUGGESTIONS.map((tit) => <option key={tit} value={tit} />)}</datalist>
          </div>
          <div>
            <label htmlFor="org" className="label">{t.orgLabel}</label>
            <input id="org" className="field uppercase" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder={t.orgPlaceholder} />
          </div>
        </div>
      )}

      <div className={category === "ordinary" ? "grid grid-cols-2 gap-3" : ""}>
        <div>
          <label htmlFor="commune" className="label">{online ? t.communeLabelOnline : t.communeLabelLocal}</label>
          <input id="commune" className="field uppercase" value={commune} onChange={(e) => setCommune(e.target.value)} />
        </div>
        {category === "ordinary" && (
          <div>
            <label htmlFor="church" className="label">{t.churchLabel}</label>
            <input id="church" className="field uppercase" value={church} onChange={(e) => setChurch(e.target.value)} />
          </div>
        )}
      </div>

      {online ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-bordeaux/[.05] px-3.5 py-2.5">
          <input type="checkbox" checked={joinGroup} onChange={(e) => setJoinGroup(e.target.checked)} className="mt-1 h-4 w-4 accent-rose" />
          <span className="text-sm leading-snug">
            <b>{t.joinGroupTitle}</b>
            <span className="block text-xs text-bordeaux/65">{t.joinGroupSub}</span>
          </span>
        </label>
      ) : (
        <>
          <div>
            <span className="label">{t.transportQuestion}</span>
            <div role="radiogroup" aria-label="Transport" className="seg grid-cols-3">
              {([["yes", t.transportYes], ["no", t.transportNo], ["unsure", t.transportUnsure]] as [Transport, string][]).map(([v, l]) => (
                <label key={v}>
                  <input type="radio" name="transport" checked={transport === v} onChange={() => setTransport(v)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          {transport === "yes" && (
            <div>
              <label htmlFor="pickup" className="label">{t.pickupLabel}</label>
              <select id="pickup" className="field" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                <option value="">{t.choosePickup}</option>
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

      {/* piège à robots : invisible, ne pas remplir */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      <Turnstile onToken={onToken} resetSignal={resetSignal} />

      {error && <p role="alert" className="rounded-xl bg-rose/10 px-3.5 py-2 text-sm font-medium text-rose-deep">{error}</p>}

      <button type="submit" disabled={busy} className="btn btn-rose w-full">
        {busy ? t.submitting : t.submitBtn}
      </button>
    </form>
  );
}
