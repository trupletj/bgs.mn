import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

interface StatusHistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  reason?: string;
  created_at: string;
  profile?: {
    name?: string;
  };
}

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "Шинэ",
    in_progress: "Процесс-д",
    approved: "Баталгаажсан",
    rejected: "Татгалзсан",
  };

  return map[status] || status;
};

const StatusBox = ({ label }: { label: string }) => (
  <div className="px-4 py-2 rounded-xl border border-muted-foreground/30 bg-background text-sm font-medium whitespace-nowrap">
    {label}
  </div>
);

export function StatusFlow({ history }: { history: StatusHistoryItem[] }) {
  const flow = [...history].reverse();

  if (!flow.length) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 py-4 overflow-x-auto">
        {/* Initial status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-pointer">
              <StatusBox label={statusLabel(flow[0].old_status)} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">Анхны төлөв</p>
          </TooltipContent>
        </Tooltip>

        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Flow */}
        {flow.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-pointer">
                  <StatusBox label={statusLabel(item.new_status)} />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  <b>Хэн:</b> {item.profile?.name || "Систем"}
                </p>
                <p>
                  <b>Хэзээ:</b>{" "}
                  {format(new Date(item.created_at), "yyyy-MM-dd HH:mm", {
                    locale: mn,
                  })}
                </p>
                {item.reason && (
                  <p>
                    <b>Шалтгаан:</b> {item.reason}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>

            {index < flow.length - 1 && (
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}
