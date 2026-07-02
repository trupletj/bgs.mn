"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BusForm } from "@/components/shift-exchange/bus-form";
import type { AutobusDirection, ShiftDirection } from "@/types/shift-exchange";

export function AddBusButton({
  exchangeId,
  exchangeDirection,
  exchangeDate,
  directions,
}: {
  exchangeId: number;
  exchangeDirection: ShiftDirection;
  exchangeDate: string;
  directions: AutobusDirection[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Автобус нэмэх
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Автобус нэмэх</DialogTitle>
            <DialogDescription>
              Шинэ автобусны хөдлөх цаг, багтаамж, нэр зэрэг мэдээллийг
              оруулна
            </DialogDescription>
          </DialogHeader>
          <BusForm
            exchangeId={exchangeId}
            exchangeDirection={exchangeDirection}
            exchangeDate={exchangeDate}
            directions={directions}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
