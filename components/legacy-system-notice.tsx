"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Нэвтрэх хуудас руу орж ирэх үед үзлэгийн хуудсын тухай сануулгыг
 *  дэлгэцийн дээд хэсэгт toast байдлаар түр зуур (автоматаар алга болдог)
 *  харуулна — доорх статик Alert-тэй ижил агуулгатай, зөвхөн анхаарал
 *  татах зорилготой. */
export function LegacySystemNoticeToast() {
  useEffect(() => {
    // Toaster (app/layout.tsx) яг энэ мөчид бүрэн mount/subscribe хийгээгүй
    // байх боломжтой тул (ялангуяа анхны page load/hydration үед) toast()-ыг
    // дараагийн macrotask руу шилжүүлж, race condition-оос сэргийлнэ.
    const t = setTimeout(() => {
      toast.warning(
        <span>
          Хэрэв та үзлэгийн хуудас бөглөх бол{" "}
          <a
            href="https://my.bgs.mn"
            className="font-medium underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}>
            my.bgs.mn
          </a>{" "}
          дарж хуучин системээр орно уу.
        </span>,
        { position: "top-center", duration: 6000 },
      );
    }, 150);
    return () => clearTimeout(t);
  }, []);

  return null;
}
