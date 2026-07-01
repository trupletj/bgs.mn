import * as XLSX from "xlsx";
import { getBusExportData } from "@/actions/shift-exchange";

export const dynamic = "force-dynamic";

const HEADER = [
  "№",
  "Бүлэг",
  "Алба / Хэлтэс",
  "Албан тушаал",
  "Овог",
  "Нэр",
  "Утас",
  "Чиглэл",
];
const COLS = [
  { wch: 4 },
  { wch: 18 },
  { wch: 24 },
  { wch: 24 },
  { wch: 14 },
  { wch: 14 },
  { wch: 13 },
  { wch: 16 },
];

/** Sheet нэр: Excel-ийн хязгаар (≤31 тэмдэгт, : \ / ? * [ ] хориотой) + давхардалгүй. */
function safeSheetName(
  name: string,
  used: Set<string>,
  fallback: string,
): string {
  const base =
    (name || fallback).replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 28) ||
    fallback;
  let candidate = base;
  let k = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, 25)} ${k++}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exchangeId = Number(id);
  const data = await getBusExportData(exchangeId);
  if (!data.exchange) {
    return new Response("Олдсонгүй эсвэл эрх алга", { status: 404 });
  }

  const title = `${data.exchange.date}-нд ${data.exchange.directionLabel} ээлжийн мэдээлэл`;
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  if (data.buses.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[title], ["Автобус алга"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Хоосон");
  }

  data.buses.forEach((bus, i) => {
    // Аялалын ахлах: "Овгийн эхний үсэг. Нэр · утас" → гарчгийн мөрөнд.
    const lead = bus.passengers.find((p) => p.isLeader);
    const leaderLabel = lead
      ? `${(lead.lastName ?? "").trim().slice(0, 1)}${
          lead.lastName ? ". " : ""
        }${lead.firstName ?? ""}`.trim()
      : null;
    const leaderInfo = leaderLabel
      ? `Аялалын ахлах: ${leaderLabel}${lead?.phone ? " · " + lead.phone : ""}`
      : "Аялалын ахлах: —";
    // Гарчиг, автобусны нэр, ахлах — нэг merge мөрөнд (олон баганад багтаахаар).
    const topLine = `${title} · ${bus.name} · ${leaderInfo}`;

    const aoa: (string | number)[][] = [
      [topLine],
      [],
      HEADER,
      ...bus.passengers.map((p, idx) => [
        idx + 1,
        p.eeljGroupName ?? "",
        p.albaOrHeltes ?? "",
        p.position ?? "",
        p.lastName ?? "",
        p.firstName ?? "",
        p.phone ?? "",
        p.directionName ?? "",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = COLS;
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      safeSheetName(bus.name, used, `Автобус ${i + 1}`),
    );
  });

  const buf = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  // Файлын нэр: ээлжийн нэр + огноо (ASCII fallback + UTF-8 RFC 5987).
  const utf8Name = `${(data.exchange.name || "ээлж").trim()} ${data.exchange.date}.xlsx`;
  const asciiName = `eelj-${data.exchange.date}.xlsx`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
        utf8Name,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
