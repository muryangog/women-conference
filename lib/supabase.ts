import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "missing-key"
);

export type PickupPoint = {
  id: number;
  zone: string;
  area: string;
  name: string;
  sort: number;
  active: boolean;
  capacity: number | null;
};

export type Registration = {
  id: string;
  full_name: string;
  phone: string;
  commune: string | null;
  church: string | null;
  category: "ordinary" | "clergy" | "honorary";
  title: string | null;
  organization: string | null;
  category_confirmed: boolean;
  source: "web" | "app";
  attendance: "onsite" | "online";
  country: string | null;
  join_group: boolean;
  needs_transport: "yes" | "no" | "unsure";
  arrival_mode?: "conference_bus" | "church_bus" | "own" | null;
  pickup_point: string | null;
  created_at: string;
};
