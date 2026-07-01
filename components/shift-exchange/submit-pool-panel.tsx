"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Trash2,
  Users,
  Phone,
  Briefcase,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Bus,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import { OrgBrowsePanel } from "@/components/shift-exchange/org-browse-panel";
import {
  removePoolSubmissions,
  searchMyOrgUsers,
  submitPassengersToPool,
} from "@/actions/shift-exchange";
import { BusyIndicator } from "@/components/ui/page-loader";
import type { PassengerAssignment } from "@/types/shift-exchange";

/** Нэр дээрх эхний үсгүүдээс товч initials гаргана. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function PassengerStatus({ p }: { p: PassengerAssignment }) {
  if (p.isConfirmed) {
    return (
      <Badge className="gap-1 border-transparent bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        QR уншсан
      </Badge>
    );
  }
  if (p.busId != null) {
    return (
      <Badge className="gap-1 border-transparent bg-sky-100 text-sky-800">
        <Bus className="h-3 w-3" />
        Автобусанд хуваарилагдсан
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-transparent bg-amber-100 text-amber-800">
      <Clock className="h-3 w-3" />
      Хүлээгдэж байна
    </Badge>
  );
}

/**
 * Rep-facing panel: submit own-organization people into an exchange pool.
 * The RPC validates org membership server-side, so picking a non-org user is
 * simply skipped (reported in the toast).
 */
export function SubmitPoolPanel({
  exchangeId,
  myPool,
  canRegister,
}: {
  exchangeId: number;
  myPool: PassengerAssignment[];
  canRegister: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const addMany = (userIds: string[]) => {
    if (userIds.length === 0) return;
    startTransition(async () => {
      const res = await submitPassengersToPool(exchangeId, userIds);
      if (res.ok) {
        if (res.inserted > 0)
          toast.success(`${res.inserted} зорчигч нэмэгдлээ`);
        else toast.error("Нэмэгдсэнгүй (өөр байгууллага эсвэл давхардсан)");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const add = (userId: string) => addMany([userId]);

  // multi-select remove — зөвхөн бүртгэлийн хугацаа нээлттэй, баталгаажаагүй үед.
  const removable = canRegister ? myPool.filter((p) => !p.isConfirmed) : [];
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const allSel =
    removable.length > 0 && removable.every((p) => selected.has(p.id));
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected(allSel ? new Set() : new Set(removable.map((p) => p.id)));
  const onBulkRemove = () =>
    startTransition(async () => {
      const res = await removePoolSubmissions([...selected], exchangeId);
      if (res.ok) {
        toast.success(`${res.count} зорчигч хасагдлаа`);
        setSelected(new Set());
        setConfirmOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <Card className="gap-4 p-4">
      <BusyIndicator busy={pending} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Миний байгууллагын зорчигчид</h2>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {myPool.length} зорчигч
        </Badge>
      </div>

      {canRegister ? (
        <Tabs defaultValue="browse">
          <TabsList className="w-full">
            <TabsTrigger value="browse" className="flex-1">
              Алба хэлтсээр
            </TabsTrigger>
            <TabsTrigger value="search" className="flex-1">
              Хайлтаар
            </TabsTrigger>
          </TabsList>
          <TabsContent value="browse" className="mt-3">
            <OrgBrowsePanel
              excludeIds={myPool.map((p) => p.internalUserId)}
              disabled={pending}
              onAdd={addMany}
            />
          </TabsContent>
          <TabsContent value="search" className="mt-3">
            <UserSearchPicker
              placeholder="Нэр, утас, ажлын байраар хайх..."
              searchFn={searchMyOrgUsers}
              excludeIds={myPool.map((p) => p.internalUserId)}
              disabled={pending}
              onSelect={(u) => add(u.id)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Бүртгэлийн хугацаа дууссан эсвэл ээлж нээгдээгүй байна — зорчигч нэмэх,
          хасах боломжгүй.
        </p>
      )}

      {myPool.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed py-8 text-center">
          <Users className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">
            Зорчигч бүртгээгүй байна
          </p>
          <p className="text-xs text-muted-foreground">
            Дээрх хайлтаас өөрийн байгууллагын хүмүүсийг нэмнэ үү
          </p>
        </div>
      ) : (
        <>
          {removable.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={allSel} onCheckedChange={toggleAll} />
                Бүгдийг сонгох
              </label>
              {selected.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">
                    {selected.size} сонгосон
                  </span>
                  <div className="flex-1" />
                  <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:bg-destructive/5 hover:text-destructive"
                        disabled={pending}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Хасах ({selected.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Сонгосон зорчигчдыг хасах уу?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Сонгосон {selected.size} зорчигчийг бүртгэлээс хасна.
                          Автобусанд хуваарилагдсан бол автобуснаас мөн хасагдана.
                          Дахин нэмэх боломжтой.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Болих</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={onBulkRemove}
                          className="bg-destructive text-white hover:bg-destructive/90">
                          Хасах
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}
          <ul className="flex flex-col gap-2">
            {myPool.map((p) => {
              // Хугацаа нээлттэй, баталгаажаагүй бол хасаж болно (автобусанд байсан ч).
              const canRemove = canRegister && !p.isConfirmed;
              return (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border p-3">
                  {canRemove ? (
                    <Checkbox
                      className="mt-1 shrink-0"
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                      aria-label={`${p.displayName} сонгох`}
                    />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(p.displayName)}
                  </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-foreground">
                      {p.displayName || "Нэргүй"}
                    </span>
                    <PassengerStatus p={p} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {p.positionName && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        {p.positionName}
                      </span>
                    )}
                    {p.albaName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {p.albaName}
                      </span>
                    )}
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="flex items-center gap-1 hover:text-foreground hover:underline">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {p.phone}
                      </a>
                    )}
                    {p.directionName && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {p.directionName}
                      </span>
                    )}
                  </div>
                </div>

                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
