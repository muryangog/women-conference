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
};

export type Registration = {
  id: string;
  full_name: string;
  phone: string;
  commune: string | null;
  church: string | null;
  attendance: "onsite" | "online";
  country: string | null;
  join_group: boolean;
  needs_transport: "yes" | "no" | "unsure";
  pickup_point: string | null;
  created_at: string;
};
