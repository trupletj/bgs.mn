import { Bus, CalendarClock, Crown, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestAutobusSeatForm } from "@/actions/eelj";
import type { EeljCard as EeljCardData, EeljRequestStatus } from "@/types/eelj";

const STATUS_LABEL: Record<EeljRequestStatus, string> = {
  requested: "Хүсэлт хүлээгдэж байна",
  approved: "Хүсэлт зөвшөөрсөн",
  force_approved: "Хүчээр хүлээж авсан",
  rejected: "Хүсэлт татгалзсан",
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

function formatDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

export function EeljCard({ card }: { card: EeljCardData }) {
  const requestable = card.requestStatus == null;
  const buttonLabel = `${formatDate(card.dayDate)}-нд ${card.isCome ? "ИРЭХ" : "БУУХ"} · ${card.autobusNumber} · Аяллын ахлахад хүсэлт илгээх`;

  return (
    <Card
      className={cn(
        "gap-3 px-4 py-4",
        card.isMyAssignment && "border-primary/40 ring-1 ring-primary/10",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatDate(card.dayDate)}
          </span>
          {card.isCome ? (
            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
              Ирэх
            </Badge>
          ) : (
            <Badge className="border-transparent bg-indigo-100 text-indigo-700">
              Буух
            </Badge>
          )}
          {card.isMyAssignment && (
            <Badge variant="outline" className="text-[11px]">
              Миний хуваарь
            </Badge>
          )}
        </div>
      </div>

      {card.leaderName && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Аяллын ахлах</p>
            <p className="truncate text-sm font-medium text-foreground">
              {card.leaderName}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field
          label="Ээлж солилцооны хот аймаг"
          value={card.directionName ?? ""}
        />
        <Field
          label="Автобусны дугаар"
          value={
            <span className="inline-flex items-center gap-1.5">
              <Bus className="h-3.5 w-3.5 text-primary" />
              {card.autobusNumber}
            </span>
          }
        />
        <Field
          label="Жолоочийн нэр"
          value={
            card.driverName ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {card.driverName}
              </span>
            ) : (
              ""
            )
          }
        />
        <Field
          label="Жолоочийн дугаар"
          value={
            card.driverPhone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {card.driverPhone}
              </span>
            ) : (
              ""
            )
          }
        />
        {(card.zamTsag != null || card.zamTsagDayDate) && (
          <>
            <Field
              label="Олгосон Зам цаг"
              value={card.zamTsag != null ? String(card.zamTsag) : ""}
            />
            <Field
              label="Зам цаг олгосон өдөр"
              value={
                card.zamTsagDayDate ? formatDate(card.zamTsagDayDate) : ""
              }
            />
          </>
        )}
      </div>

      <div className="border-t border-border/60 pt-3">
        {requestable ? (
          <form action={requestAutobusSeatForm}>
            <input type="hidden" name="eelj_id" value={card.eeljId} />
            <input type="hidden" name="autobus_id" value={card.autobusId} />
            <Button
              type="submit"
              className="w-full whitespace-normal text-center text-xs font-bold uppercase"
              variant="destructive"
            >
              {buttonLabel}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <StatusBadge status={card.requestStatus!} />
            {card.requestStatus === "rejected" &&
              card.requestDecisionReason && (
                <p className="text-xs text-rose-600">
                  Шалтгаан: {card.requestDecisionReason}
                </p>
              )}
          </div>
        )}
      </div>
    </Card>
  );
}
