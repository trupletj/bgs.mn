"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { deleteDevice } from "@/actions/devices";
import { Trash2 } from "lucide-react";

export function DeleteDeviceButton({ deviceId, deviceName }: { deviceId: string; deviceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteDevice(deviceId);
        toast.success("Төхөөрөмж устгагдлаа");
        router.push("/devices");
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
        setOpen(false);
      }
    });
  };

  return (
    <>
      <Button
        variant="outline" size="sm"
        className="h-8 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Устгах
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Төхөөрөмж устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deviceName}</span> төхөөрөмжийг устгах гэж байна.
              Энэ үйлдлийг буцаах боломжгүй. Хариуцагч, засварын бүртгэл болон өөрчлөлтийн түүх бүгд устана.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Болих</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? "Устгаж байна..." : "Устгах"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
