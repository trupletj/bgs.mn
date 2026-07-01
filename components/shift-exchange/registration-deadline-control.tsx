"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarClock, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateTime24 } from "@/components/shift-exchange/datetime-24";
import { setRegistrationOverride } from "@/actions/shift-exchange";
import { registrationDeadline } from "@/components/shift-exchange/shared";

/**
 * HR control: бүртгэлийн анхдагч эцсийн хугацааг (exchange_date - 2 өдөр) тодорхой
 * огноо хүртэл түр сунгах / цуцлах.
 */
export function RegistrationDeadlineControl({
  exchangeId,
  exchangeDate,
  registrationOverrideUntil,
}: {
  exchangeId: number;
  exchangeDate: string;
  registrationOverrideUntil: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const deadline = registrationDeadline(exchangeDate);
  const overrideActive =
    !!registrationOverrideUntil &&
    Date.now() <= new Date(registrationOverrideUntil).getTime();

  const save = () => {
    if (!value) return;
    startTransition(async () => {
      const iso = new Date(value).toISOString();
      const res = await setRegistrationOverride(exchangeId, iso);
      if (res.ok) {
        toast.success("Бүртгэлийн хугацаа сунгагдлаа");
        setValue("");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const clear = () =>
    startTransition(async () => {
      const res = await setRegistrationOverride(exchangeId, null);
      if (res.ok) {
        toast.success("Сунгалт цуцлагдлаа");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <Card className="gap-0 p-0">
      {/* compact summary — дарж дэлгэрэнгүй/тохиргоо нээнэ */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">Бүртгэлийн хугацаа</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          · {deadline} хүртэл
        </span>
        {overrideActive && (
          <Badge className="border-transparent bg-amber-100 text-[11px] text-amber-800">
            Сунгасан
          </Badge>
        )}
        <span className="flex-1" />
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Гадаад компанийн төлөөлөгч{" "}
            <span className="font-medium tabular-nums text-foreground">
              {deadline}
            </span>{" "}
            хүртэл (ээлжээс 2 хоногийн өмнө) зорчигч бүртгэх/устгах боломжтой.
            {registrationOverrideUntil && (
              <span
                className={
                  "ml-1 " +
                  (overrideActive
                    ? "text-amber-600"
                    : "text-muted-foreground")
                }>
                {overrideActive ? "Одоо" : "Өмнө нь"}{" "}
                {new Date(registrationOverrideUntil).toLocaleString("mn-MN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}{" "}
                хүртэл сунгасан.
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Тодорхой огноо/цаг хүртэл түр нээх
              </label>
              <DateTime24 value={value} onChange={setValue} />
            </div>
            <Button size="sm" disabled={pending || !value} onClick={save}>
              Сунгах
            </Button>
            {registrationOverrideUntil && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={clear}>
                <X className="h-4 w-4" />
                Сунгалт цуцлах
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
