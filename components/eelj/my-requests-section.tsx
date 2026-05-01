import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Inbox } from "lucide-react";
import type { EeljRequestStatus, MyEeljRequest } from "@/types/eelj";

const STATUS_LABEL: Record<EeljRequestStatus, string> = {
  requested: "Хүлээгдэж байна",
  approved: "Зөвшөөрсөн",
  force_approved: "Хүчээр оруулсан",
  rejected: "Татгалзсан",
};

function StatusBadge({ status }: { status: EeljRequestStatus }) {
  switch (status) {
    case "requested":
      return (
        <Badge className="border-transparent bg-amber-100 text-amber-700">
          {STATUS_LABEL[status]}
        </Badge>
      );
    case "approved":
      return (
        <Badge className="border-transparent bg-emerald-100 text-emerald-700">
          {STATUS_LABEL[status]}
        </Badge>
      );
    case "force_approved":
      return (
        <Badge className="border-transparent bg-cyan-100 text-cyan-700">
          {STATUS_LABEL[status]}
        </Badge>
      );
    case "rejected":
      return <Badge variant="destructive">{STATUS_LABEL[status]}</Badge>;
  }
}

function formatRequestedAt(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MyRequestsSection({ requests }: { requests: MyEeljRequest[] }) {
  if (requests.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-8 text-center">
        <Inbox className="h-7 w-7 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Илгээсэн хүсэлт байхгүй</p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => (
        <Card key={r.id} className="gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {r.autobusNumber ?? "—"}
              </span>
              {r.directionName && (
                <Badge variant="outline" className="text-xs">
                  {r.directionName}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                · {r.eeljName}
              </span>
            </div>
            <StatusBadge status={r.status} />
          </div>
          {r.comment && (
            <p className="text-xs text-muted-foreground">«{r.comment}»</p>
          )}
          {r.status === "rejected" && r.decisionReason && (
            <p className="text-xs text-rose-600">
              Шалтгаан: {r.decisionReason}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70">
            Илгээсэн: {formatRequestedAt(r.requestedAt)}
          </p>
        </Card>
      ))}
    </div>
  );
}
