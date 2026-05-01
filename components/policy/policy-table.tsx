"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatPolicyDate,
  policyStatusVariant,
  type PolicyDashboardItem,
} from "@/lib/policy-utils";

export function PolicyTable({
  policies,
  onSelect,
  selectedId,
}: {
  policies: PolicyDashboardItem[];
  onSelect: (policy: PolicyDashboardItem) => void;
  selectedId?: string | null;
}) {
  if (policies.length === 0) {
    return (
      <Card className="items-center gap-2 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Журам олдсонгүй
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <TooltipProvider delayDuration={150}>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 text-center">№</TableHead>
              <TableHead>Журмын нэр</TableHead>
              <TableHead className="w-28">Батлагдсан</TableHead>
              <TableHead className="w-40">Хэрэгжилт</TableHead>
              <TableHead className="w-24 text-center">Шалгагдсан</TableHead>
              <TableHead className="w-24">Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.map((p, i) => {
              const variant = policyStatusVariant(p.implementationPercent);
              const noRating = p.validCount === 0;
              return (
                <TableRow
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedId === p.id && "bg-primary/5",
                  )}
                >
                  <TableCell className="text-center text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate">{p.name}</span>
                          {p.reference_code && (
                            <span className="truncate text-xs font-normal text-muted-foreground">
                              {p.reference_code}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-md whitespace-normal"
                      >
                        <p className="font-semibold">{p.name}</p>
                        {p.reference_code && (
                          <p className="mt-0.5 text-[11px] opacity-70">
                            {p.reference_code}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {formatPolicyDate(p.approved_date)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={p.implementationPercent}
                        indicatorClassName={variant.bar}
                        className="h-2 flex-1"
                      />
                      <span className="w-10 text-right text-sm font-bold tabular-nums text-foreground">
                        {p.implementationPercent}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                    {p.validCount} / {p.checkedCount}
                  </TableCell>
                  <TableCell>
                    {noRating ? (
                      <Badge className="border-transparent bg-amber-100 text-amber-700">
                        Хүлээлтэнд
                      </Badge>
                    ) : (
                      <Badge
                        className={cn("border-transparent", variant.badge)}
                      >
                        {variant.label}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TooltipProvider>
    </Card>
  );
}
