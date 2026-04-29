"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateDeviceRequestStatus } from "@/actions/devices";
import { CheckCircle2, XCircle } from "lucide-react";

export function DeviceRequestActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const handleConfirm = () => {
    if (!dialog) return;
    startTransition(async () => {
      try {
        await updateDeviceRequestStatus(requestId, dialog === "approve" ? "approved" : "rejected", adminNotes);
        toast.success(dialog === "approve" ? "Хүсэлт зөвшөөрөгдлөө" : "Хүсэлт татгалзагдлаа");
        setDialog(null);
        setAdminNotes("");
        router.refresh();
      } catch (e: any) {
        toast.error(e.message ?? "Алдаа гарлаа");
      }
    });
  };

  return (
    <>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setDialog("approve")}
          title="Зөвшөөрөх"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-600 hover:border-emerald-600 hover:text-white"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setDialog("reject")}
          title="Татгалзах"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 transition-colors hover:bg-red-600 hover:border-red-600 hover:text-white"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "approve" ? "Хүсэлт зөвшөөрөх" : "Хүсэлт татгалзах"}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="px-1">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Тайлбар {dialog === "reject" && <span className="text-destructive">*</span>}
            </p>
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={dialog === "approve" ? "Нэмэлт тэмдэглэл (заавал биш)..." : "Татгалзсан шалтгаан..."}
              rows={3}
              className="resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <Button
              onClick={handleConfirm}
              disabled={pending || (dialog === "reject" && !adminNotes.trim())}
              className={dialog === "approve"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-destructive hover:bg-destructive/90 text-white"}
            >
              {pending ? "Боловсруулж байна..." : dialog === "approve" ? "Зөвшөөрөх" : "Татгалзах"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
