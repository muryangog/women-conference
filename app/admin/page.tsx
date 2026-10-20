"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, type PickupPoint, type Registration } from "@/lib/supabase";
import { ARRIVAL_LABELS, CATEGORY_LABELS, TRANSPORT_LABELS } from "@/lib/config";
import { fetchAll } from "@/lib/fetchAll";

type CheckIn = { registration_id: string; checked_in_at: string; device: string | null };
type Tab = "list" | "live" | "points";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const pointKey = (p: PickupPoint) => `${p.zone} · ${p.name}`;

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [rows, setRows] = useState<Registration[]>([]);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [refreshed, setRefreshed] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState("");

  const [tab, setTab] = useState<Tab>("list");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "yes" | "no" | "unsure">("all");
  const [mode, setMode] = useState<"all" | "onsite" | "online">("all");
  const [cat, setCat] = useState<"all" | "ordinary" | "clergy" | "honorary" | "pending">("all");
  const [pres, setPres] = useState<"all" | "present" | "absent">("all");

  const [nz, setNz] = useState("Quartier Sud");
  const [na, setNa] = useState("");
  const [nn, setNn] = useState("");

  const load = useCallback(async () => {
    const { data: ok } = await supabase.rpc("is_admin");
    setIsAdmin(ok === true);
    if (ok !== true) return;
    try {
      const [r, p, c] = await Promise.all([
        fetchAll<Registration>("registrations", "*", [{ col: "created_at", asc: false }, { col: "id" }]),
        supabase.from("pickup_points").select("*").order("sort"),
        fetchAll<CheckIn>("check_ins", "registration_id, checked_in_at, device", [{ col: "registration_id" }]),
      ]);
      setRows(r);
      setPoints((p.data as PickupPoint[]) ?? []);
      setCheckins(c);
      setRefreshed(new Date());
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Chargement impossible");
    }
  }, []);

  // rafraîchissement léger : seulement les présences (petit), sans retélécharger toute la liste
  const refreshCheckins = useCallback(async () => {
    try {
      setCheckins(await fetchAll<CheckIn>("check_ins", "registration_id, checked_in_at, device", [{ col: "registration_id" }]));
      setRefreshed(new Date());
    } catch {
      /* on réessaie au prochain tour */
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) await load();
      setReady(true);
    });
  }, [load]);

  // onglet « Présences » : présences toutes les 30 s, liste complète toutes les 5 min
  useEffect(() => {
    if (tab !== "live" || !isAdmin) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      void (n % 10 === 0 ? load() : refreshCheckins());
    }, 30000);
    return () => clearInterval(t);
  }, [tab, isAdmin, load, refreshCheckins]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setAuthError("Email ou mot de passe incorrect.");
    setSignedIn(true);
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSignedIn(false); setIsAdmin(false); setRows([]); setPoints([]); setCheckins([]);
  }

  /* ---------- données dérivées ---------- */
  const presentMap = useMemo(() => new Map(checkins.map((c) => [c.registration_id, c])), [checkins]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.needs_transport === filter) &&
        (mode === "all" || r.attendance === mode) &&
        (cat === "all" || (cat === "pending" ? r.category !== "ordinary" && !r.category_confirmed : r.category === cat)) &&
        (pres === "all" || (pres === "present") === presentMap.has(r.id)) &&
        (!s || [r.full_name, r.phone, r.commune, r.church, r.pickup_point, r.country, r.title, r.organization].some((v) => (v ?? "").toLowerCase().includes(s)))
    );
  }, [rows, q, filter, mode, cat, pres, presentMap]);

  const onsite = useMemo(() => rows.filter((r) => r.attendance === "onsite"), [rows]);
  const presentCount = checkins.length;
  const percent = onsite.length ? Math.min(100, Math.round((presentCount / onsite.length) * 100)) : 0;

  const byCategory = useMemo(
    () =>
      (["ordinary", "clergy", "honorary"] as const).map((c) => {
        const all = onsite.filter((r) => r.category === c);
        return { c, total: all.length, present: all.filter((r) => presentMap.has(r.id)).length };
      }),
    [onsite, presentMap]
  );

  const byHour = useMemo(() => {
    const m = new Map<number, number>();
    checkins.forEach((c) => {
      const h = new Date(c.checked_in_at).getHours();
      m.set(h, (m.get(h) ?? 0) + 1);
    });
    return [...m].sort((a, b) => a[0] - b[0]);
  }, [checkins]);

  const recent = useMemo(
    () => [...checkins].sort((a, b) => b.checked_in_at.localeCompare(a.checked_in_at)).slice(0, 8),
    [checkins]
  );

  const reservedByPoint = useMemo(() => {
    const m = new Map<string, { reserved: number; present: number }>();
    rows.filter((r) => r.needs_transport === "yes" && r.pickup_point).forEach((r) => {
      const v = m.get(r.pickup_point!) ?? { reserved: 0, present: 0 };
      m.set(r.pickup_point!, { reserved: v.reserved + 1, present: v.present + (presentMap.has(r.id) ? 1 : 0) });
    });
    return m;
  }, [rows, presentMap]);

  const buses = useMemo(() => {
    const keys = new Set<string>([...points.map(pointKey), ...reservedByPoint.keys()]);
    return [...keys]
      .map((k) => {
        const p = points.find((x) => pointKey(x) === k);
        const v = reservedByPoint.get(k) ?? { reserved: 0, present: 0 };
        return { key: k, capacity: p?.capacity ?? null, ...v };
      })
      .filter((b) => b.reserved > 0 || b.capacity !== null)
      .sort((a, b) => b.reserved - a.reserved);
  }, [points, reservedByPoint]);

  const count = (t: string) => rows.filter((r) => r.needs_transport === t).length;

  /* ---------- actions ---------- */
  function exportCsv() {
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Nom", "Catégorie", "Titre", "Téléphone", "Participation", "Pays", "Rassemblement", "Commune / ville", "Église / association", "Transport", "Point de départ", "Moyen d'arrivée", "Présente", "Heure d'arrivée", "Date d'inscription"];
    const lines = filtered.map((r) => {
      const ci = presentMap.get(r.id);
      return [
        r.full_name, CATEGORY_LABELS[r.category], r.title, r.phone, r.attendance === "online" ? "En ligne" : "Sur place",
        r.country, r.join_group ? "Oui" : "", r.commune, r.organization ?? r.church,
        r.attendance === "online" ? "" : TRANSPORT_LABELS[r.needs_transport], r.pickup_point,
        r.arrival_mode ? ARRIVAL_LABELS[r.arrival_mode] : "",
        ci ? "Oui" : "Non", ci ? new Date(ci.checked_in_at).toLocaleString("fr-FR") : "",
        new Date(r.created_at).toLocaleString("fr-FR"),
      ].map(esc).join(";");
    });
    const blob = new Blob(["\uFEFF" + [head.map(esc).join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Supprimer l'inscription de ${name} ?`)) return;
    await supabase.from("registrations").delete().eq("id", id);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  async function confirmCategory(id: string) {
    const { error } = await supabase.from("registrations").update({ category_confirmed: true }).eq("id", id);
    if (!error) setRows((r) => r.map((x) => (x.id === id ? { ...x, category_confirmed: true } : x)));
  }

  async function addPoint(e: React.FormEvent) {
    e.preventDefault();
    if (!na.trim() || !nn.trim()) return;
    const sort = Math.max(0, ...points.map((p) => p.sort)) + 1;
    await supabase.from("pickup_points").insert({ zone: nz.trim(), area: na.trim(), name: nn.trim(), sort });
    setNn("");
    await load();
  }

  async function togglePoint(p: PickupPoint) {
    await supabase.from("pickup_points").update({ active: !p.active }).eq("id", p.id);
    await load();
  }

  async function setCapacity(p: PickupPoint, v: string) {
    const n = v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0);
    if (n === p.capacity) return;
    const { error } = await supabase.from("pickup_points").update({ capacity: n }).eq("id", p.id);
    if (!error) setPoints((ps) => ps.map((x) => (x.id === p.id ? { ...x, capacity: n } : x)));
  }

  /* ---------- écrans ---------- */
  if (!ready) return <main className="p-8 text-bordeaux">Chargement…</main>;

  if (!signedIn)
    return (
      <main className="mx-auto max-w-sm px-5 py-16">
        <h1 className="font-display text-4xl font-semibold text-bordeaux">Espace organisatrices</h1>
        <form onSubmit={signIn} className="mt-6 space-y-4">
          <div><label className="label" htmlFor="e">Email</label>
            <input id="e" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label" htmlFor="p">Mot de passe</label>
            <input id="p" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {authError && <p role="alert" className="text-sm font-medium text-rose-deep">{authError}</p>}
          <button className="btn btn-rose w-full">Se connecter</button>
        </form>
      </main>
    );

  if (!isAdmin)
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="rounded-xl bg-rose/10 p-4 text-rose-deep">
          Ce compte n&apos;a pas le rôle « admin ». Les pointeurs utilisent l&apos;application mobile. Pour donner l&apos;accès admin,
          mets <code>role = &apos;admin&apos;</code> dans la table <code>admins</code> de Supabase.
        </p>
        <button onClick={signOut} className="btn mt-4 border-2 border-bordeaux/30 text-bordeaux">Se déconnecter</button>
      </main>
    );

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? "bg-white text-rose-deep shadow" : "text-bordeaux/70"}`}>
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-bordeaux">Urugori rw&apos;igisagara</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/badges" className="btn border-2 border-bordeaux/30 px-4 py-2 text-sm text-bordeaux">Badges</Link>
          <button onClick={signOut} className="btn border-2 border-bordeaux/30 px-4 py-2 text-sm text-bordeaux">Déconnexion</button>
        </div>
      </header>

      <div className="mt-4 inline-flex gap-1 rounded-xl bg-bordeaux/[.07] p-1">
        {tabBtn("list", "Inscrits")}
        {tabBtn("live", "Présences en direct")}
        {tabBtn("points", "Points de départ")}
      </div>
      {loadError && <p className="mt-3 rounded-xl bg-rose/10 p-3 text-sm text-rose-deep">Chargement incomplet : {loadError}</p>}

      {/* ===================== INSCRITS ===================== */}
      {tab === "list" && (
        <>
          <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-6">
            {[["Inscrites", rows.length], ["Sur place", onsite.length], ["En ligne", rows.length - onsite.length], ["Transport : oui", count("yes")], ["Clergé / personnalités", rows.filter((r) => r.category !== "ordinary").length], ["Présentes", presentCount]].map(([l, n]) => (
              <div key={l as string} className="rounded-2xl bg-rose px-4 py-3 text-creme">
                <p className="font-display text-4xl font-bold">{n}</p>
                <p className="text-sm text-creme/85">{l}</p>
              </div>
            ))}
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            <input className="field max-w-xs" placeholder="Rechercher un nom, un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field max-w-[13rem]" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="all">Sur place + en ligne</option>
              <option value="onsite">Sur place</option>
              <option value="online">En ligne</option>
            </select>
            <select className="field max-w-[13rem]" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
              <option value="all">Toutes catégories</option>
              <option value="ordinary">Ordinaires</option>
              <option value="clergy">Clergé</option>
              <option value="honorary">Personnalités</option>
              <option value="pending">À confirmer (protocole)</option>
            </select>
            <select className="field max-w-[13rem]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Tout transport</option>
              <option value="yes">Transport : oui</option>
              <option value="unsure">Transport : peut-être</option>
              <option value="no">Sans transport</option>
            </select>
            <select className="field max-w-[13rem]" value={pres} onChange={(e) => setPres(e.target.value as typeof pres)}>
              <option value="all">Présentes + absentes</option>
              <option value="present">Présentes</option>
              <option value="absent">Pas encore arrivées</option>
            </select>
            <button onClick={exportCsv} className="btn btn-rose px-5 py-3 text-sm">Exporter en CSV ({filtered.length})</button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-bordeaux/15 bg-white">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-bordeaux text-creme">
                <tr>{["Nom", "Téléphone", "Participation", "Commune / ville", "Église / association", "Transport", "Point de départ", "Arrivée", "Présence", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ci = presentMap.get(r.id);
                  return (
                    <tr key={r.id} className={`border-t border-bordeaux/10 ${r.category !== "ordinary" ? "bg-creme/50" : ""}`}>
                      <td className="px-3 py-2 font-medium">
                        {r.category !== "ordinary" && (
                          <span className={`mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.category_confirmed ? "bg-rose text-creme" : "bg-creme text-bordeaux ring-1 ring-rose"}`}>
                            {CATEGORY_LABELS[r.category]}{r.category_confirmed ? "" : " · à confirmer"}
                          </span>
                        )}
                        {r.title ? `${r.title} ` : ""}{r.full_name}
                      </td>
                      <td className="px-3 py-2"><a href={`tel:${r.phone}`} className="underline">{r.phone}</a></td>
                      <td className="px-3 py-2">{r.attendance === "online" ? `En ligne · ${r.country ?? ""}${r.join_group ? " · rassemblement" : ""}` : "Sur place"}</td>
                      <td className="px-3 py-2">{r.commune}</td>
                      <td className="px-3 py-2">{r.organization ?? r.church}</td>
                      <td className="px-3 py-2">{r.attendance === "online" ? "" : TRANSPORT_LABELS[r.needs_transport]}</td>
                      <td className="px-3 py-2">{r.pickup_point}</td>
                      <td className="px-3 py-2">{r.arrival_mode ? ARRIVAL_LABELS[r.arrival_mode] : ""}</td>
                      <td className="whitespace-nowrap px-3 py-2">{ci ? <span className="font-semibold text-green-700">✓ {hhmm(ci.checked_in_at)}</span> : <span className="text-bordeaux/40">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {r.category !== "ordinary" && !r.category_confirmed && (
                          <button onClick={() => confirmCategory(r.id)} className="mr-3 font-semibold text-rose underline">Confirmer</button>
                        )}
                        <button onClick={() => remove(r.id, r.full_name)} className="text-rose-deep underline">Supprimer</button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-bordeaux/60">Aucune inscription ne correspond.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ===================== PRÉSENCES EN DIRECT ===================== */}
      {tab === "live" && (
        <section className="mt-5 space-y-5">
          <div className="rounded-3xl bg-bordeaux p-6 text-creme">
            <p className="text-sm text-creme/70">Présentes sur place</p>
            <p className="font-display text-6xl font-bold">{presentCount}<span className="text-2xl font-medium text-creme/70"> / {onsite.length}</span></p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-rose" style={{ width: `${percent}%` }} /></div>
            <p className="mt-2 text-sm text-creme/70">
              {percent} % des inscrites sur place
              {refreshed ? ` · mis à jour à ${refreshed.toLocaleTimeString("fr-FR")} (toutes les 30 s)` : ""}
              {" "}<button onClick={() => void load()} className="underline">Actualiser</button>
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {byCategory.map((x) => (
              <div key={x.c} className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
                <p className="text-sm font-semibold text-bordeaux/70">{CATEGORY_LABELS[x.c]}</p>
                <p className="font-display text-4xl font-bold text-rose">{x.present}<span className="text-lg font-medium text-bordeaux/50"> / {x.total}</span></p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {(["church_bus", "own", "conference_bus"] as const).map((m) => (
              <div key={m} className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
                <p className="text-sm font-semibold text-bordeaux/70">{ARRIVAL_LABELS[m]}</p>
                <p className="font-display text-4xl font-bold text-rose">{rows.filter((r) => r.arrival_mode === m).length}</p>
              </div>
            ))}
            <p className="text-xs text-bordeaux/60 md:col-span-3">Moyen d&apos;arrivée renseigné lors de l&apos;enregistrement sur place (application mobile).</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
              <h2 className="font-display text-xl font-bold text-bordeaux">Arrivées par heure</h2>
              {byHour.length === 0 ? <p className="mt-2 text-sm text-bordeaux/60">Aucune arrivée pour l&apos;instant.</p> : (
                <ul className="mt-3 space-y-1.5">
                  {byHour.map(([h, n]) => (
                    <li key={h} className="flex items-center gap-2 text-sm">
                      <span className="w-10 text-bordeaux/70">{h}h</span>
                      <span className="h-4 rounded bg-rose" style={{ width: `${Math.max(4, (n / Math.max(...byHour.map((x) => x[1]))) * 70)}%` }} />
                      <b>{n}</b>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
              <h2 className="font-display text-xl font-bold text-bordeaux">Dernières arrivées</h2>
              {recent.length === 0 ? <p className="mt-2 text-sm text-bordeaux/60">Aucune arrivée pour l&apos;instant.</p> : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {recent.map((c) => {
                    const r = byId.get(c.registration_id);
                    return (
                      <li key={c.registration_id} className="flex justify-between gap-3 border-b border-bordeaux/10 py-1">
                        <span className="font-medium">{r ? `${r.title ? r.title + " " : ""}${r.full_name}` : "—"}</span>
                        <span className="text-bordeaux/60">{hhmm(c.checked_in_at)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
            <h2 className="font-display text-xl font-bold text-bordeaux">Bus par point de départ</h2>
            {buses.length === 0 ? <p className="mt-2 text-sm text-bordeaux/60">Aucune réservation de transport.</p> : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead><tr className="text-bordeaux/60"><th className="py-1 font-semibold">Point</th><th className="font-semibold">Réservées</th><th className="font-semibold">Arrivées</th><th className="font-semibold">Places</th><th /></tr></thead>
                  <tbody>
                    {buses.map((b) => {
                      const full = b.capacity !== null && b.reserved >= b.capacity;
                      const near = b.capacity !== null && !full && b.reserved >= b.capacity * 0.9;
                      return (
                        <tr key={b.key} className="border-t border-bordeaux/10">
                          <td className="py-1.5">{b.key}</td><td>{b.reserved}</td><td>{b.present}</td><td>{b.capacity ?? "—"}</td>
                          <td>{full ? <span className="rounded-full bg-rose px-2 py-0.5 text-xs font-bold text-creme">COMPLET</span> : near ? <span className="rounded-full bg-creme px-2 py-0.5 text-xs font-bold text-rose-deep ring-1 ring-rose">presque plein</span> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===================== POINTS DE DÉPART ===================== */}
      {tab === "points" && (
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <form onSubmit={addPoint} className="h-fit space-y-3 rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
            <h2 className="font-display text-xl font-bold text-bordeaux">Ajouter un point de départ</h2>
            <div><label className="label" htmlFor="nz">Zone</label>
              <input id="nz" className="field" list="zones" value={nz} onChange={(e) => setNz(e.target.value)} />
              <datalist id="zones"><option value="Quartier Sud" /><option value="Quartier Nord" /></datalist></div>
            <div><label className="label" htmlFor="na">Secteur (ex : Kiriri)</label>
              <input id="na" className="field" value={na} onChange={(e) => setNa(e.target.value)} /></div>
            <div><label className="label" htmlFor="nn">Nom du point</label>
              <input id="nn" className="field" value={nn} onChange={(e) => setNn(e.target.value)} /></div>
            <button className="btn btn-rose">Ajouter</button>
          </form>

          <div className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4 text-sm">
            <h2 className="font-display text-xl font-bold text-bordeaux">Places dans les bus</h2>
            <p className="mb-2 text-xs text-bordeaux/60">Indique le nombre de places par point : une alerte s&apos;affiche quand il est atteint.</p>
            <ul>
              {points.map((p) => {
                const v = reservedByPoint.get(pointKey(p))?.reserved ?? 0;
                const full = p.capacity !== null && v >= p.capacity;
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bordeaux/10 py-1.5">
                    <span className={`min-w-0 flex-1 ${p.active ? "" : "text-bordeaux/40 line-through"}`}>{p.zone} · {p.area} · <strong>{p.name}</strong></span>
                    <span className={full ? "font-bold text-rose" : "text-bordeaux/70"}>{v} réservée{v > 1 ? "s" : ""}{full ? " · COMPLET" : ""}</span>
                    <input type="number" min={0} defaultValue={p.capacity ?? ""} placeholder="places" aria-label={`Places ${p.name}`}
                      onBlur={(e) => void setCapacity(p, e.target.value)} className="w-20 rounded-lg border border-bordeaux/20 px-2 py-1" />
                    <button onClick={() => togglePoint(p)} className="text-rose-deep underline">{p.active ? "Masquer" : "Réactiver"}</button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
