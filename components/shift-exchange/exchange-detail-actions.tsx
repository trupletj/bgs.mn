"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { deleteShiftExchange } from "@/actions/shift-exchange";

export function ExchangeDetailActions({ id }: { id: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onDelete = () =>
    startTransition(async () => {
      const res = await deleteShiftExchange(id);
      if (res.ok) {
        toast.success("Устгагдлаа");
        router.push("/shift-exchange");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        disabled={pending}
        title="Ээлж устгах"
        onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ээлж устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              Энэ ээлж болон түүний бүх автобус, хуваарилалт устана. Буцаах
              боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Устгах</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
