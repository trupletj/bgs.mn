"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Sparkles } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { autoDistributePool } from "@/actions/shift-exchange";
import { BusyIndicator } from "@/components/ui/page-loader";

/**
 * Ухаалаг хуваарилах: pool дахь зорчигчдыг чиглэлээр нь байгаа автобусанд
 * автоматаар хуваарилна (шинэ автобус үүсгэхгүй — автобусууд гадаад системээс
 * sync орж ирдэг). Багтахгүй бол pool-д үлдэнэ. Хэдийн хуваарилагдсан хүн
 * хэвээр үлдэнэ.
 */
export function SmartAssignButton({
  exchangeId,
  pooledCount,
}: {
  exchangeId: number;
  pooledCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const res = await autoDistributePool(exchangeId);
      if (res.ok) {
        toast.success(
          `${res.assigned} зорчигч байгаа автобусанд хуваарилагдлаа` +
            (res.stillPooled > 0
              ? ` · ${res.stillPooled} автобус дүүрсэн тул хуваарилаагүй үлдлээ`
              : ""),
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  return (
    <>
      <BusyIndicator busy={pending} />
      <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1"
          disabled={pending || pooledCount === 0}>
          <Sparkles className="h-4 w-4" />
          Ухаалаг хуваарилах
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ухаалаг хуваарилах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            Хуваарилаагүй {pooledCount} зорчигчийг чиглэлээр нь байгаа
            автобусуудад автоматаар хуваарилна (шинэ автобус үүсгэхгүй).
            Багтахгүй зорчигч хуваарилаагүй хэвээр үлдэнэ. Хэдийн хуваарилагдсан
            хүмүүс хэвээр үлдэнэ.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Болих</AlertDialogCancel>
          <AlertDialogAction onClick={run}>Хуваарилах</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
