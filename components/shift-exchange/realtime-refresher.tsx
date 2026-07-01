"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

/**
 * passenger_assignments-ийн өөрчлөлтийг (QR уншилт, баталгаажуулалт, хуваарилалт)
 * Realtime-аар сонсож, тухайн ээлжийн хуудсыг автоматаар сэргээнэ. Олон өөрчлөлт
 * зэрэг ирэхэд (bulk) нэг л refresh болгож debounce хийнэ.
 */
export function RealtimeRefresher({ exchangeId }: { exchangeId: number }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel(`shift-exchange-${exchangeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "bgs_attendance",
          table: "passenger_assignments",
          filter: `shift_exchange_id=eq.${exchangeId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [exchangeId, router]);

  return null;
}
