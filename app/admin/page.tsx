"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, type PickupPoint, type Registration } from "@/lib/supabase";
import { CATEGORY_LABELS, TRANSPORT_LABELS } from "@/lib/config";

type Tab = "list" | "points";

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [rows, setRows] = useState<Registration[]>([]);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "yes" | "no" | "unsure">("all");
  const [mode, setMode] = useState<"all" | "onsite" | "online">("all");
  const [cat, setCat] = useState<"all" | "ordinary" | "clergy" | "honorary" | "pending">("all");
  const [tab, setTab] = useState<Tab>("list");

  const [nz, setNz] = useState("Quartier Sud");
  const [na, setNa] = useState("");
  const [nn, setNn] = useState("");

  const load = useCallback(async () => {
    const { data: ok } = await supabase.rpc("is_admin");
    setIsAdmin(ok === true);
    if (ok !== true) return;
    const [r, p] = await Promise.all([
      supabase.from("registrations").select("*").order("created_at", { ascending: false }),
      supabase.from("pickup_points").select("*").order("sort"),
    ]);
    setRows((r.data as Registration[]) ?? []);
    setPoints((p.data as PickupPoint[]) ?? []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSignedIn(!!data.session);
      if (data.session) await load();
      setReady(true);
    });
  }, [load]);

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
    setSignedIn(false); setIsAdmin(false); setRows([]); setPoints([]);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.needs_transport === filter) &&
        (mode === "all" || r.attendance === mode) &&
        (cat === "all" || (cat === "pending" ? r.category !== "ordinary" && !r.category_confirmed : r.category === cat)) &&
        (!s || [r.full_name, CATEGORY_LABELS[r.category], r.title, r.phone, r.commune, r.church, r.pickup_point, r.country, r.title, r.organization].some((v) => (v ?? "").toLowerCase().includes(s)))
    );
  }, [rows, q, filter, mode, cat]);

  const byPickup = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((r) => r.needs_transport === "yes" && r.pickup_point)
      .forEach((r) => m.set(r.pickup_point!, (m.get(r.pickup_point!) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const byCountry = useMemo(() => {
    const m = new Map<string, { total: number; group: number }>();
    rows.filter((r) => r.attendance === "online").forEach((r) => {
      const k = r.country ?? "Non précisé";
      const v = m.get(k) ?? { total: 0, group: 0 };
      m.set(k, { total: v.total + 1, group: v.group + (r.join_group ? 1 : 0) });
    });
    return [...m].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const count = (t: string) => rows.filter((r) => r.needs_transport === t).length;

  function exportCsv() {
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const head = ["Nom", "Catégorie", "Titre", "Téléphone", "Participation", "Pays", "Rassemblement", "Commune / ville", "Église / association", "Transport", "Point de départ", "Date"];
    const lines = filtered.map((r) =>
      [r.full_name, r.phone, r.attendance === "online" ? "En ligne" : "Sur place", r.country, r.join_group ? "Oui" : "", r.commune, r.organization ?? r.church, r.attendance === "online" ? "" : TRANSPORT_LABELS[r.needs_transport], r.pickup_point,
        new Date(r.created_at).toLocaleString("fr-FR")].map(esc).join(";"));
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
          Ce compte n&apos;est pas autorisé. Ajoute son email dans la table <code>admins</code> de Supabase.
        </p>
        <button onClick={signOut} className="btn mt-4 border-2 border-bordeaux/30 text-bordeaux">Se déconnecter</button>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-bordeaux">Inscriptions</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab(tab === "list" ? "points" : "list")} className="btn border-2 border-bordeaux/30 px-4 py-2 text-sm text-bordeaux">
            {tab === "list" ? "Points de départ" : "Voir les inscrites"}
          </button>
          <button onClick={signOut} className="btn border-2 border-bordeaux/30 px-4 py-2 text-sm text-bordeaux">Déconnexion</button>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Inscrites", rows.length], ["Sur place", rows.filter((r) => r.attendance === "onsite").length], ["En ligne", rows.filter((r) => r.attendance === "online").length], ["Transport : oui", count("yes")], ["Clergé / personnalités", rows.filter((r) => r.category !== "ordinary").length]].map(([l, n]) => (
          <div key={l as string} className="rounded-2xl bg-rose px-4 py-3 text-creme">
            <p className="font-display text-4xl font-bold">{n}</p>
            <p className="text-sm text-creme/85">{l}</p>
          </div>
        ))}
      </section>

      {tab === "list" ? (
        <>
          {byCountry.length > 0 && (
            <section className="mt-6 rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
              <h2 className="font-display text-xl font-bold text-bordeaux">En ligne, par pays</h2>
              <p className="text-xs text-bordeaux/60">Le chiffre entre parenthèses = celles qui veulent un rassemblement.</p>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {byCountry.map(([n, v]) => (
                  <li key={n} className="flex justify-between border-b border-bordeaux/10 py-1">
                    <span>{n}</span><strong>{v.total} <span className="font-normal text-bordeaux/60">({v.group})</span></strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {byPickup.length > 0 && (
            <section className="mt-6 rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
              <h2 className="font-display text-xl font-bold text-bordeaux">Passagères par point de départ</h2>
              <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {byPickup.map(([n, c]) => (
                  <li key={n} className="flex justify-between border-b border-bordeaux/10 py-1"><span>{n}</span><strong>{c}</strong></li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <input className="field max-w-xs" placeholder="Rechercher un nom, un numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field max-w-[14rem]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">Tout le monde</option>
              <option value="yes">Transport : oui</option>
              <option value="unsure">Transport : peut-être</option>
              <option value="no">Sans transport</option>
            </select>
            <select className="field max-w-[14rem]" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="all">Sur place + en ligne</option>
              <option value="onsite">Sur place</option>
              <option value="online">En ligne</option>
            </select>
            <select className="field max-w-[14rem]" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
              <option value="all">Toutes catégories</option>
              <option value="ordinary">Ordinaires</option>
              <option value="clergy">Clergé</option>
              <option value="honorary">Personnalités</option>
              <option value="pending">À confirmer (protocole)</option>
            </select>
            <button onClick={exportCsv} className="btn btn-rose px-5 py-3 text-sm">Exporter en CSV ({filtered.length})</button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-bordeaux/15 bg-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-bordeaux text-creme">
                <tr>{["Nom", "Téléphone", "Participation", "Commune / ville", "Église / association", "Transport", "Point de départ", ""].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
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
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {r.category !== "ordinary" && !r.category_confirmed && (
                        <button onClick={() => confirmCategory(r.id)} className="mr-3 font-semibold text-rose underline">Confirmer</button>
                      )}
                      <button onClick={() => remove(r.id, r.full_name)} className="text-rose-deep underline">Supprimer</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-bordeaux/60">Aucune inscription ne correspond.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr]">
          <form onSubmit={addPoint} className="space-y-3 rounded-2xl border-2 border-bordeaux/15 bg-white p-4">
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
          <ul className="rounded-2xl border-2 border-bordeaux/15 bg-white p-4 text-sm">
            {points.map((p) => (
              <li key={p.id} className="flex items-center justify-between border-b border-bordeaux/10 py-1.5">
                <span className={p.active ? "" : "text-bordeaux/40 line-through"}>{p.zone} · {p.area} · <strong>{p.name}</strong></span>
                <button onClick={() => togglePoint(p)} className="text-rose-deep underline">{p.active ? "Masquer" : "Réactiver"}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
