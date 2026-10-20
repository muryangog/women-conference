"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase, type Registration } from "@/lib/supabase";
import { CATEGORY_LABELS } from "@/lib/config";
import { fetchAll } from "@/lib/fetchAll";
import { qrPayload } from "@/lib/qr";

type State = "loading" | "login" | "denied" | "ok";

export default function BadgesPage() {
  const [state, setState] = useState<State>("loading");
  const [rows, setRows] = useState<Registration[]>([]);
  const [cat, setCat] = useState<"all" | Registration["category"]>("all");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const cache = useRef<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setState("login");
      const { data: ok } = await supabase.rpc("is_admin");
      if (ok !== true) return setState("denied");
      setRows(await fetchAll<Registration>("registrations", "*", [{ col: "full_name" }, { col: "id" }]));
      setState("ok");
    })();
  }, []);

  const list = useMemo(
    () => rows.filter((r) => r.attendance === "onsite" && (cat === "all" || r.category === cat)),
    [rows, cat]
  );

  useEffect(() => {
    let stop = false;
    (async () => {
      for (const r of list) {
        if (!cache.current[r.id]) {
          cache.current[r.id] = await QRCode.toDataURL(qrPayload(r.id), { margin: 0, width: 240, errorCorrectionLevel: "M" });
        }
      }
      if (!stop) setQrs({ ...cache.current });
    })();
    return () => { stop = true; };
  }, [list]);

  if (state === "loading") return <main className="p-8 text-bordeaux">Chargement…</main>;
  if (state !== "ok")
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <p className="rounded-xl bg-rose/10 p-4 text-rose-deep">
          {state === "login" ? "Connecte-toi d'abord à l'espace organisatrices." : "Ce compte n'a pas le rôle « admin »."}
        </p>
        <Link href="/admin" className="btn btn-rose mt-4">Aller à l&apos;espace organisatrices</Link>
      </main>
    );

  return (
    <main>
      <style>{`
        @page { size: A4; margin: 10mm; }
        .sheet { display: grid; grid-template-columns: repeat(2, 90mm); justify-content: center; }
        .badge { width: 90mm; height: 60mm; box-sizing: border-box; border: 0.2mm dashed #c9b8bf; display: flex; flex-direction: column;
                 overflow: hidden; break-inside: avoid; background: #fff; color: #3a0a1d;
                 -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .b-top { height: 11mm; background: #5A0C2B; display: flex; align-items: center; justify-content: space-between; padding: 0 3.5mm; }
        .b-top span { color: #F8EBCB; font-size: 6.5pt; letter-spacing: .08em; font-weight: 600; }
        .b-mid { flex: 1; display: flex; align-items: center; gap: 3mm; padding: 2mm 3.5mm; min-height: 0; }
        .b-text { flex: 1; min-width: 0; }
        .b-title { font-size: 8.5pt; font-weight: 700; color: #B8205A; letter-spacing: .06em; }
        .b-name { font-size: 15pt; line-height: 1.05; font-weight: 800; color: #5A0C2B; word-break: break-word; }
        .b-org { font-size: 8pt; margin-top: 1.2mm; color: #6b3a4d; }
        .b-qr { width: 25mm; height: 25mm; flex: none; }
        .b-band { height: 9mm; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 9.5pt; letter-spacing: .12em; }
        @media print { .no-print { display: none !important; } body { background: #fff !important; } }
      `}</style>

      <div className="no-print mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4">
        <Link href="/admin" className="text-sm font-semibold text-rose underline">← Retour</Link>
        <select className="field max-w-[14rem]" value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
          <option value="all">Tous (sur place)</option>
          <option value="clergy">Clergé</option>
          <option value="honorary">Personnalités</option>
          <option value="ordinary">Ordinaires</option>
        </select>
        <button onClick={() => window.print()} className="btn btn-rose px-5 py-2.5 text-sm">Imprimer / enregistrer en PDF ({list.length})</button>
        <p className="w-full text-xs text-bordeaux/60">
          Dans la fenêtre d&apos;impression : format A4, marges « par défaut », et active « Graphiques d&apos;arrière-plan ». 8 badges par page.
        </p>
      </div>

      <div className="sheet">
        {list.map((r) => {
          const band =
            r.category === "honorary" ? { bg: "#5A0C2B", fg: "#F5D79B", label: "PERSONNALITÉ" }
            : r.category === "clergy" ? { bg: "#B8205A", fg: "#FFFFFF", label: "CLERGÉ" }
            : { bg: "#F8EBCB", fg: "#5A0C2B", label: "PARTICIPANTE" };
          return (
            <div key={r.id} className="badge">
              <div className="b-top">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/urugori-logo.png" alt="" style={{ height: "7mm", width: "auto" }} />
                <span>24 OCT. 2026 · KININDO LARGE</span>
              </div>
              <div className="b-mid">
                <div className="b-text">
                  {r.title ? <div className="b-title">{r.title}</div> : null}
                  <div className="b-name">{r.full_name}</div>
                  {(r.organization ?? r.church) ? <div className="b-org">{r.organization ?? r.church}</div> : null}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qrs[r.id] ? <img className="b-qr" src={qrs[r.id]} alt="" /> : <div className="b-qr" />}
              </div>
              <div className="b-band" style={{ background: band.bg, color: band.fg }}>{band.label}</div>
            </div>
          );
        })}
      </div>
      {list.length === 0 && <p className="no-print p-8 text-center text-bordeaux/60">Aucune inscrite dans cette catégorie.</p>}
      <span className="no-print hidden">{CATEGORY_LABELS.ordinary}</span>
    </main>
  );
}
