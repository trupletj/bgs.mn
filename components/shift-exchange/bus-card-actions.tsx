"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteBus } from "@/actions/shift-exchange";

/**
 * Автобусны карт дээрх үйлдлийн цэс (устгах). Карт нь <Link> тул trigger дээр
 * preventDefault/stopPropagation хийж навигацийг таслана.
 */
export function BusCardActions({
  exchangeId,
  busId,
  busName,
  passengerCount,
}: {
  exchangeId: number;
  busId: number;
  busName: string;
  passengerCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDelete = () =>
    startTransition(async () => {
      const res = await deleteBus(busId, exchangeId);
      if (res.ok) {
        toast.success(
          res.movedToPool > 0
            ? `Автобус устлаа · ${res.movedToPool} зорчигч хуваарилаагүй жагсаалт руу шилжлээ`
            : "Автобус устлаа",
        );
        setConfirmOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            onClick={stop}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop}>
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              stop(e);
              setConfirmOpen(true);
            }}>
            <Trash2 className="h-4 w-4" />
            Устгах
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent onClick={stop}>
          <AlertDialogHeader>
            <AlertDialogTitle>«{busName}» автобусыг устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              {passengerCount > 0
                ? `Бүртгэлтэй ${passengerCount} зорчигч устахгүй — Хуваарилаагүй зорчигчид руу шилжинэ.`
                : "Энэ автобусыг устгана."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90">
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
