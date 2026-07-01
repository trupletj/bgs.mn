// utils/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// React `cache` нь нэг хүсэлт дотор schema-аар memoize хийнэ — өөр өөр
// schema-нд тус тусын client. Хүсэлт хооронд утга хуваалцахгүй (cookie leak-аас сэргийлнэ).
const _build = cache(async (schema: string) => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
      ...(schema !== "public" ? { db: { schema } } : {}),
    }
  );
});

/** Public schema client (Server Components / Server Actions). */
export const createClient = async () => _build("public");

/** Client bound to a non-public schema, e.g. `bgs_attendance`. */
export const createClientForSchema = (schema: string) => _build(schema);
