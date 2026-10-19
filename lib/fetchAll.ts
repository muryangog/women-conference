import { supabase } from "./supabase";

/** Lit toute une table par pages de 1000 lignes (Supabase plafonne chaque requête à 1000). */
export async function fetchAll<T>(
  table: string,
  columns: string,
  orders: { col: string; asc?: boolean }[]
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    let q = supabase.from(table).select(columns);
    for (const o of orders) q = q.order(o.col, { ascending: o.asc ?? true });
    const { data, error } = await q.range(from, from + size - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as T[];
    out.push(...page);
    if (page.length < size) break;
  }
  return out;
}
