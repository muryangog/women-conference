import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ["ordinary", "clergy", "honorary"];
const TRANSPORT = ["yes", "no", "unsure"];

// limite très simple par adresse IP (best effort : la vraie protection est Turnstile)
const hits = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 60;
}

async function turnstileOk(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // non configuré : on ne bloque pas
  if (typeof token !== "string" || !token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const up = (v: unknown, max: number): string | null => str(v, max).toUpperCase() || null;

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnu";
  if (tooMany(ip)) return NextResponse.json({ error: "Trop de tentatives, réessaie dans quelques minutes." }, { status: 429 });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // piège à robots : ce champ caché reste vide chez une vraie personne
  if (typeof b.website === "string" && b.website.length > 0) return NextResponse.json({ ok: true });

  if (!(await turnstileOk(b.turnstile, ip))) {
    return NextResponse.json({ error: "Vérification anti-robot échouée. Recharge la page et réessaie." }, { status: 400 });
  }

  const category = CATEGORIES.includes(b.category as string) ? (b.category as string) : "ordinary";
  const attendance = b.attendance === "online" ? "online" : "onsite";
  const phone = str(b.phone, 20);
  const fullName = up(b.full_name, 120);
  const title = category === "ordinary" ? null : up(b.title, 80);
  const organization = category === "ordinary" ? null : up(b.organization, 160);
  const country = attendance === "online" ? str(b.country, 80) : "Burundi";
  let needsTransport = TRANSPORT.includes(b.needs_transport as string) ? (b.needs_transport as string) : "no";
  if (attendance === "online") needsTransport = "no";
  const pickup = attendance === "onsite" && needsTransport === "yes" ? str(b.pickup_point, 120) : null;

  if (!fullName || fullName.length < 2) return NextResponse.json({ error: "Nom invalide." }, { status: 400 });
  if (!/^\+[0-9]{7,15}$/.test(phone)) return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  if (category !== "ordinary" && (!title || !organization)) return NextResponse.json({ error: "Titre et association requis." }, { status: 400 });
  if (attendance === "online" && !country) return NextResponse.json({ error: "Pays requis." }, { status: 400 });
  if (attendance === "onsite" && needsTransport === "yes" && !pickup) return NextResponse.json({ error: "Point de départ requis." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Configuration du serveur incomplète." }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false } });

  const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : crypto.randomUUID();
  const { error } = await db.from("registrations").insert({
    id,
    full_name: fullName,
    phone,
    commune: up(b.commune, 120),
    church: category === "ordinary" ? up(b.church, 120) : null,
    category,
    title,
    organization,
    attendance,
    country,
    join_group: attendance === "online" && b.join_group === true,
    needs_transport: needsTransport,
    pickup_point: pickup,
    category_confirmed: false,
    source: "web",
  });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ce numéro est déjà inscrit." }, { status: 409 });
    return NextResponse.json({ error: "L'inscription n'a pas abouti. Réessaie." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
