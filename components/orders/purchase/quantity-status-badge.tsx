import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatQuantity, getUnitLabel } from "./utils";

export function QuantityStatusBadge({
  target,
  purchased,
  remaining,
  unit,
  className,
}: {
  target: number;
  purchased: number;
  remaining: number;
  unit: string;
  className?: string;
}) {
  const unitLabel = getUnitLabel(unit);

  if (remaining <= 0) {
    return (
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap items-center gap-1.5 text-xs",
          className,
        )}>
        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-muted-foreground">
          Захиалсан{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatQuantity(target)} {unitLabel}
          </span>
        </span>
        <Badge className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 hover:bg-emerald-50">
          <CheckCircle2 className="h-3 w-3" />
          Бүрэн авсан
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-1.5 text-xs",
        className,
      )}>
      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-muted-foreground">
        Нийт{" "}
        <span className="font-semibold tabular-nums text-foreground">
          {formatQuantity(target)} {unitLabel}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
        Авсан{" "}
        <span className="font-semibold tabular-nums">
          {formatQuantity(purchased)} {unitLabel}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
        Үлд{" "}
        <span className="font-semibold tabular-nums">
          {formatQuantity(remaining)} {unitLabel}
        </span>
      </span>
    </div>
  );
}
