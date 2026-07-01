"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Bus, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DirectionBadge,
  StatusBadge,
  isFridayDate,
} from "@/components/shift-exchange/shared";
import { setExchangeRegistrationOpen } from "@/actions/shift-exchange";
import type { ShiftExchangeWithStats } from "@/types/shift-exchange";

function RegistrationSwitch({
  id,
  open,
}: {
  id: number;
  open: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(open);
  const [pending, startTransition] = useTransition();

  const onToggle = (next: boolean) => {
    setChecked(next); // optimistic
    startTransition(async () => {
      const res = await setExchangeRegistrationOpen(id, next);
      if (res.ok) {
        toast.success(next ? "Бүртгэл нээгдлээ" : "Бүртгэл хаагдлаа");
        router.refresh();
      } else {
        setChecked(!next); // rollback
        toast.error(res.error);
      }
    });
  };

  return (
    <Switch
      checked={checked}
      disabled={pending}
      onCheckedChange={onToggle}
      aria-label="Бусад компани хүн нэмэх"
    />
  );
}

export function ExchangeListClient({
  exchanges,
  canAdmin = false,
}: {
  exchanges: ShiftExchangeWithStats[];
  canAdmin?: boolean;
}) {
  const [fridayOnly, setFridayOnly] = useState(false);

  const rows = useMemo(
    () =>
      fridayOnly
        ? exchanges.filter((e) => isFridayDate(e.exchangeDate))
        : exchanges,
    [exchanges, fridayOnly],
  );

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={fridayOnly}
          onCheckedChange={(v) => setFridayOnly(!!v)}
        />
        Зөвхөн Баасан гарагийн ээлж харуулах
      </label>

      {rows.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-12 text-center">
          <Bus className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Ээлж алга</p>
          <p className="text-sm text-muted-foreground">
            {fridayOnly
              ? "Баасан гарагийн ээлж олдсонгүй"
              : "Ойрын хугацаанд ээлж солилцоо алга байна"}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Нэр</TableHead>
                <TableHead className="w-32">Огноо</TableHead>
                <TableHead className="w-24">Чиглэл</TableHead>
                <TableHead className="w-28">Төлөв</TableHead>
                {canAdmin && (
                  <TableHead className="w-36">Бусад компани</TableHead>
                )}
                <TableHead className="w-40">Статистик</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => {
                const friday = isFridayDate(e.exchangeDate);
                return (
                  <TableRow
                    key={e.id}
                    className={
                      "group " +
                      (friday ? "bg-amber-50 hover:bg-amber-100/70" : "")
                    }>
                    <TableCell>
                      <Link
                        href={`/shift-exchange/${e.id}`}
                        className={
                          "hover:underline " +
                          (friday
                            ? "font-semibold text-amber-900"
                            : "font-medium text-foreground")
                        }>
                        {e.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {e.exchangeDate}
                        {friday && (
                          <Badge className="border-transparent bg-amber-200 text-amber-900">
                            Баасан
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DirectionBadge direction={e.direction} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    {canAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RegistrationSwitch
                            id={e.id}
                            open={e.openForRegistration}
                          />
                          <span className="text-xs text-muted-foreground">
                            {e.openForRegistration ? "Нээлттэй" : "Хаалттай"}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                        <span className="flex items-center gap-1">
                          <Bus className="h-3.5 w-3.5" />
                          {e.busCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {e.passengerCount}
                        </span>
                        <span className="text-emerald-600">
                          ✓ {e.confirmedCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/shift-exchange/${e.id}`}
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
