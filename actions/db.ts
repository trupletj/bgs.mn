"use server";
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/utils/supabase/supabaseAdmin";

export type QueryOptions = {
  columns?: string; // e.g., '*', 'id,name'
  limit?: number;
  orderBy?: { column: string; ascending?: boolean; nullsFirst?: boolean };
  eq?: Record<string, string | number | boolean | null>;
};

export async function readTable<T = any>(table: string, opts: QueryOptions = {}): Promise<{
  data: T[];
  error: PostgrestError | null;
}> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from(table).select(opts.columns ?? "*");

  if (opts.orderBy) {
    q = q.order(opts.orderBy.column, {
      ascending: opts.orderBy.ascending ?? true,
      nullsFirst: opts.orderBy.nullsFirst ?? false,
    });
  }

  if (opts.eq) {
    for (const [k, v] of Object.entries(opts.eq)) {
      q = (q as any).eq(k, v as any);
    }
  }

  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  return { data: (data as T[]) ?? [], error };
}
