"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import { DateTime24 } from "@/components/shift-exchange/datetime-24";
import { DirectionBadge } from "@/components/shift-exchange/shared";
import { createBus, updateBus, type BusInput } from "@/actions/shift-exchange";
import type {
  AutobusDirection,
  BusWithStats,
  ShiftDirection,
} from "@/types/shift-exchange";

export function BusForm({
  exchangeId,
  exchangeDirection,
  exchangeDate,
  directions,
  initial,
  onDone,
}: {
  exchangeId: number;
  /** Ээлжийн чиглэл (bgs_attendance.shift_exchanges.direction) — автобус
   *  үргэлж энэтэй адил чиглэлтэй тул хэрэглэгчээр дахин сонгуулахгүй. */
  exchangeDirection: ShiftDirection;
  /** Ээлжийн огноо (bgs_attendance.shift_exchanges.exchange_date) — шинэ
   *  автобусны хөдлөх огноог үүгээр урьдчилж тохируулна, цагийг нь л сонгоно. */
  exchangeDate: string;
  directions: AutobusDirection[];
  initial?: BusWithStats;
  /** Өгвөл хадгалсны дараа навигац хийхгүй, энэ callback-ийг дуудна (dialog-д). */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? 45));
  const [departureTime, setDepartureTime] = useState(
    initial?.departureTime
      ? new Date(initial.departureTime).toISOString().slice(0, 16)
      : `${exchangeDate}T00:30`,
  );
  const [leader, setLeader] = useState<{ id: string; name: string } | null>(
    initial?.tripLeaderId
      ? { id: initial.tripLeaderId, name: initial.tripLeaderName ?? "" }
      : null,
  );
  const [selectedDirs, setSelectedDirs] = useState<string[]>(
    initial?.directions.map((d) => d.id) ?? [],
  );

  const toggleDir = (dirId: string) =>
    setSelectedDirs((prev) =>
      prev.includes(dirId) ? prev.filter((x) => x !== dirId) : [...prev, dirId],
    );

  const onSubmit = () => {
    if (!name.trim()) {
      toast.error("Автобусны нэр шаардлагатай");
      return;
    }
    const input: BusInput = {
      direction: exchangeDirection,
      name: name.trim(),
      description: description || null,
      capacity: Number(capacity) || 45,
      departureTime: departureTime
        ? new Date(departureTime).toISOString()
        : null,
      tripLeaderId: leader?.id ?? null,
      directionIds: selectedDirs,
    };
    startTransition(async () => {
      const res = initial
        ? await updateBus(initial.id, exchangeId, input)
        : await createBus(exchangeId, input);
      if (res.ok) {
        toast.success(initial ? "Шинэчлэгдлээ" : "Автобус нэмэгдлээ");
        if (onDone) {
          onDone();
          router.refresh();
        } else {
          router.push(`/shift-exchange/${exchangeId}`);
          router.refresh();
        }
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Чиглэл</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm text-muted-foreground">
            <DirectionBadge direction={exchangeDirection} />
            <span className="text-xs">Ээлжийн чиглэлээр</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Багтаамж</Label>
          <Input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Нэр</Label>
        <Input
          placeholder="Улаанбаатар 1 + Дархан"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Тайлбар</Label>
        <Textarea
          rows={2}
          placeholder="Улаанбаатараас уурхай руу, замаараа Дарханаас зорчигч авна"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Хөдлөх цаг</Label>
        <DateTime24 value={departureTime} onChange={setDepartureTime} />
      </div>

      <div className="space-y-1.5">
        <Label>Дамжих чиглэлүүд</Label>
        <div className="flex flex-wrap gap-2">
          {directions.map((d) => {
            const active = selectedDirs.includes(d.id);
            const order = selectedDirs.indexOf(d.id) + 1;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDir(d.id)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted")
                }>
                {active ? `${order}. ` : ""}
                {d.name}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Дарсан дараалал нь зогсоолын дараалал болно.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Аялалын ахлах</Label>
        {leader ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{leader.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setLeader(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <UserSearchPicker
            placeholder="Аялалын ахлах хайх..."
            onSelect={(u) =>
              setLeader({
                id: u.id,
                name: `${u.last_name ?? ""} ${u.first_name ?? ""}`.trim(),
              })
            }
          />
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => (onDone ? onDone() : router.back())}>
          Болих
        </Button>
        <Button type="button" onClick={onSubmit} disabled={pending}>
          {pending ? "Хадгалж байна..." : initial ? "Хадгалах" : "Нэмэх"}
        </Button>
      </div>
    </div>
  );
}
