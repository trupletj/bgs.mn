import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Phone } from "lucide-react";
import {
  approveAutobusRequestForm,
  rejectAutobusRequestForm,
} from "@/actions/eelj";
import type { PendingRequest } from "@/types/eelj";

function formatRequestedAt(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function PendingRequestsSection({
  requests,
}: {
  requests: PendingRequest[];
}) {
  if (requests.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-6 text-center">
        <Bell className="h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Шинэ хүсэлт байхгүй</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => {
        const fullName =
          [r.requesterLastName, r.requesterFirstName]
            .filter(Boolean)
            .join(" ") || `bteg_id ${r.requesterBtegId ?? "?"}`;
        return (
          <Card key={r.id} className="gap-3 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {fullName}
                  </span>
                  {r.requesterPosition && (
                    <Badge variant="outline" className="text-[11px]">
                      {r.requesterPosition}
                    </Badge>
                  )}
                </div>
                {r.requesterDepartment && (
                  <p className="text-xs text-muted-foreground">
                    {r.requesterDepartment}
                  </p>
                )}
                {r.requesterPhone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {r.requesterPhone}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 text-right">
                <span className="text-sm font-medium text-foreground">
                  {r.autobusNumber}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {r.eeljName}
                </span>
              </div>
            </div>

            {r.comment && (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground">
                «{r.comment}»
              </p>
            )}

            <p className="text-[11px] text-muted-foreground/70">
              Илгээсэн: {formatRequestedAt(r.requestedAt)}
            </p>

            <div className="flex items-center justify-end gap-2">
              <form action={rejectAutobusRequestForm}>
                <input type="hidden" name="request_id" value={r.id} />
                <Button type="submit" variant="outline" size="sm">
                  Татгалзах
                </Button>
              </form>
              <form action={approveAutobusRequestForm}>
                <input type="hidden" name="request_id" value={r.id} />
                <Button type="submit" size="sm">
                  Зөвшөөрөх
                </Button>
              </form>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
