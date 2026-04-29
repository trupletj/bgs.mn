import { Badge } from "@/components/ui/badge";
import { DEVICE_STATUS_CONFIG, DEVICE_TYPE_CONFIG, type DeviceStatus, type DeviceType } from "@/types/device";
import { cn } from "@/lib/utils";

export function DeviceStatusBadge({ status }: { status: string }) {
  const cfg = DEVICE_STATUS_CONFIG[status as DeviceStatus] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-xs px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export function DeviceTypeBadge({ type }: { type: string }) {
  const cfg = DEVICE_TYPE_CONFIG[type as DeviceType];
  return (
    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 border-slate-200">
      {cfg?.label ?? type}
    </Badge>
  );
}
