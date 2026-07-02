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
  Inbox,
  UserPlus,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import { OrgBrowsePanel } from "@/components/shift-exchange/org-browse-panel";
import { MyOrgEeljPicker } from "@/components/shift-exchange/my-org-eelj-picker";
import {
  removePoolSubmissions,
  searchMyOrgUsers,
  submitPassengersToPool,
} from "@/actions/shift-exchange";
import { searchUsers } from "@/actions/users";
import { BusyIndicator } from "@/components/ui/page-loader";
import type {
  EeljGroupOption,
  Organization,
  PassengerAssignment,
} from "@/types/shift-exchange";

const OTHER = "Бусад";

interface AlbaGroup {
  alba: string;
  members: PassengerAssignment[];
  heltesBlocks: { heltes: string; members: PassengerAssignment[] }[];
}

/** Алба (байхгүй бол хэлтэс) → хэлтэс гэсэн 2 давхар бүлэглэл — зүүн талын
 *  OrgBrowsePanel-тэй яг ижил зарчим. */
function groupByAlba(items: PassengerAssignment[]): AlbaGroup[] {
  const byAlba = new Map<string, PassengerAssignment[]>();
  for (const p of items) {
    const key = p.albaName?.trim() || p.heltesName?.trim() || OTHER;
    const arr = byAlba.get(key);
    if (arr) arr.push(p);
    else byAlba.set(key, [p]);
  }
  return [...byAlba.entries()].map(([alba, members]) => {
    const byHeltes = new Map<string, PassengerAssignment[]>();
    for (const p of members) {
      const hk = p.heltesName?.trim() || OTHER;
      const arr = byHeltes.get(hk);
      if (arr) arr.push(p);
      else byHeltes.set(hk, [p]);
    }
    return {
      alba,
      members,
      heltesBlocks: [...byHeltes.entries()].map(([heltes, hMembers]) => ({
        heltes,
        members: hMembers,
      })),
    };
  });
}

function PassengerStatus({ p }: { p: PassengerAssignment }) {
  if (p.isConfirmed) {
    return (
      <Badge className="gap-1 border-transparent bg-emerald-100 text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        QR уншсан{p.busName ? ` — ${p.busName}` : ""}
      </Badge>
    );
  }
  if (p.busId != null) {
    return (
      <Badge className="gap-1 border-transparent bg-sky-100 text-sky-800">
        <Bus className="h-3 w-3" />
        {p.busName
          ? `"${p.busName}" автобусанд хуваарилагдсан`
          : "Автобусанд хуваарилагдсан"}
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
 *
 * super_admin (companies share one HR department) can instead pick any
 * company and register its people too — the RPC lifts the org restriction
 * for that role.
 *
 * Дэлгэц 2 босоо хэсэгтэй: ЗҮҮН — бүх байгууллагын зорчигчдоос сонгож нэмэх
 * (browse/search), БАРУУН — энэ ээлжинд бүртгэгдсэн pool (Хуваарилсан /
 * Хуваарилаагүй гэсэн дотоод Tabs-тай, тус бүрдээ sticky footbar-тай).
 */
export function SubmitPoolPanel({
  exchangeId,
  myPool,
  canRegister,
  isSuperAdmin = false,
  organizations = [],
  myOrgEeljGroups = [],
  linkedGroupIds = new Set(),
}: {
  exchangeId: number;
  myPool: PassengerAssignment[];
  canRegister: boolean;
  isSuperAdmin?: boolean;
  organizations?: Organization[];
  /** super_admin биш rep-д зориулсан — зөвхөн өөрийн байгууллагад
   *  харьяалагдах ээлжийн бүлгүүд ("Ээлжийн бүлгээр" tab-д ашиглана). */
  myOrgEeljGroups?: EeljGroupOption[];
  linkedGroupIds?: Set<string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [orgId, setOrgId] = useState("");

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

  const assignedList = myPool.filter((p) => p.busId != null);
  const unassignedList = myPool.filter((p) => p.busId == null);

  const onBulkRemove = (
    ids: number[],
    clear: () => void,
    closeDialog: () => void,
  ) =>
    startTransition(async () => {
      const res = await removePoolSubmissions(ids, exchangeId);
      if (res.ok) {
        toast.success(`${res.count} зорчигч хасагдлаа`);
        clear();
        closeDialog();
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      {/* ЗҮҮН: бүх байгууллагын зорчигчдоос сонгож нэмэх */}
      <Card className="gap-4 p-4 lg:sticky lg:top-4">
        <BusyIndicator busy={pending} />
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Зорчигч нэмэх</h2>
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
              {!isSuperAdmin && (
                <TabsTrigger value="eelj" className="flex-1">
                  Ээлжийн бүлгээр
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="browse" className="mt-3 space-y-3">
              {isSuperAdmin && (
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger className="h-9 w-full">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Байгууллага сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.btegId} value={o.btegId}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <OrgBrowsePanel
                excludeIds={myPool.map((p) => p.internalUserId)}
                disabled={pending}
                onAdd={addMany}
                orgOverride={isSuperAdmin ? orgId || null : undefined}
              />
            </TabsContent>
            <TabsContent value="search" className="mt-3">
              <UserSearchPicker
                placeholder="Нэр, утас, ажлын байраар хайх..."
                searchFn={isSuperAdmin ? searchUsers : searchMyOrgUsers}
                excludeIds={myPool.map((p) => p.internalUserId)}
                disabled={pending}
                onSelect={(u) => add(u.id)}
              />
            </TabsContent>
            {!isSuperAdmin && (
              <TabsContent value="eelj" className="mt-3">
                <MyOrgEeljPicker
                  exchangeId={exchangeId}
                  groups={myOrgEeljGroups}
                  linkedGroupIds={linkedGroupIds}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Бүртгэлийн хугацаа дууссан эсвэл ээлж нээгдээгүй байна — зорчигч
            нэмэх, хасах боломжгүй.
          </p>
        )}
      </Card>

      {/* БАРУУН: энэ ээлжинд бүртгэгдсэн зорчигчид */}
      <Card className="gap-4 p-4">
        <BusyIndicator busy={pending} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {isSuperAdmin
                ? "Бүх байгууллагын аялалд хамрагдах зорчигчид"
                : "Аялалд хамрагдах зорчигчид"}
            </h2>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {myPool.length} зорчигч
          </Badge>
        </div>

        {myPool.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed py-8 text-center">
            <Users className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">
              Зорчигч бүртгээгүй байна
            </p>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin
                ? "Зүүн талын хайлтаас байгууллагын хүмүүсийг нэмнэ үү"
                : "Зүүн талын хайлтаас өөрийн байгууллагын хүмүүсийг нэмнэ үү"}
            </p>
          </div>
        ) : (
          <Tabs defaultValue="assigned">
            <TabsList className="w-full">
              <TabsTrigger value="assigned" className="flex-1 gap-1.5">
                <Bus className="h-3.5 w-3.5" />
                Автобусанд хуваарилагдсан
                <Badge variant="secondary" className="tabular-nums">
                  {assignedList.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="unassigned" className="flex-1 gap-1.5">
                <Inbox className="h-3.5 w-3.5" />
                Хуваарилаагүй
                <Badge variant="secondary" className="tabular-nums">
                  {unassignedList.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="assigned" className="mt-3">
              <PassengerColumn
                items={assignedList}
                canRegister={canRegister}
                isSuperAdmin={isSuperAdmin}
                pending={pending}
                onBulkRemove={onBulkRemove}
                emptyText="Автобусанд хуваарилагдсан хүн алга"
              />
            </TabsContent>
            <TabsContent value="unassigned" className="mt-3">
              <PassengerColumn
                items={unassignedList}
                canRegister={canRegister}
                isSuperAdmin={isSuperAdmin}
                pending={pending}
                onBulkRemove={onBulkRemove}
                emptyText="Хуваарилаагүй хүн алга"
              />
            </TabsContent>
          </Tabs>
        )}
      </Card>
    </div>
  );
}

function PassengerColumn({
  items,
  canRegister,
  isSuperAdmin,
  pending,
  onBulkRemove,
  emptyText,
}: {
  items: PassengerAssignment[];
  canRegister: boolean;
  isSuperAdmin: boolean;
  pending: boolean;
  onBulkRemove: (
    ids: number[],
    clear: () => void,
    closeDialog: () => void,
  ) => void;
  emptyText: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const clear = () => setSelected(new Set());
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (ids: number[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const groups = groupByAlba(items);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={groups.map((g) => g.alba)}
          className="space-y-2">
          {groups.map((g) => {
            const removableIds = canRegister
              ? g.members.filter((p) => !p.isConfirmed).map((p) => p.id)
              : [];
            const allSel =
              removableIds.length > 0 &&
              removableIds.every((id) => selected.has(id));
            return (
              <AccordionItem
                key={g.alba}
                value={g.alba}
                className="rounded-lg border px-3">
                <AccordionTrigger className="items-center py-3 hover:no-underline">
                  <div className="flex flex-1 items-center gap-2 text-left">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{g.alba}</span>
                    <Badge variant="secondary" className="tabular-nums">
                      {g.members.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-3">
                  {removableIds.length > 0 && (
                    <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox
                        checked={allSel}
                        onCheckedChange={(v) => toggleMany(removableIds, !!v)}
                      />
                      Энэ албыг бүгдийг сонгох ({removableIds.length})
                    </label>
                  )}

                  {g.heltesBlocks.map((hb) => (
                    <div key={hb.heltes} className="space-y-1">
                      {(g.heltesBlocks.length > 1 || hb.heltes !== g.alba) &&
                      hb.heltes !== OTHER ? (
                        <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                          {hb.heltes}
                        </p>
                      ) : null}
                      {hb.members.map((p) => {
                        const canRemove = canRegister && !p.isConfirmed;
                        const Row = (
                          <>
                            <span className="font-medium text-foreground">
                              {p.displayName || "Нэргүй"}
                            </span>
                            {isSuperAdmin && p.organizationName && (
                              <Badge
                                variant="outline"
                                className="gap-1 text-[11px]">
                                <Building2 className="h-3 w-3" />
                                {p.organizationName}
                              </Badge>
                            )}
                            <PassengerStatus p={p} />
                            {p.positionName && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Briefcase className="h-3 w-3 shrink-0" />
                                {p.positionName}
                              </span>
                            )}
                            {p.phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3 shrink-0" />
                                {p.phone}
                              </span>
                            )}
                            {p.directionName && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {p.directionName}
                              </span>
                            )}
                          </>
                        );
                        return canRemove ? (
                          <label
                            key={p.id}
                            className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm">
                            <Checkbox
                              checked={selected.has(p.id)}
                              onCheckedChange={() => toggleOne(p.id)}
                            />
                            {Row}
                          </label>
                        ) : (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md border px-2.5 py-1.5 text-sm">
                            {Row}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-0 z-20 flex justify-center py-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-primary/40 bg-background px-4 py-3 shadow-xl">
            <Badge variant="secondary" className="tabular-nums">
              {selected.size} сонгосон
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground"
              onClick={clear}>
              Цуцлах
            </Button>
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
                    onClick={() =>
                      onBulkRemove([...selected], clear, () =>
                        setConfirmOpen(false),
                      )
                    }
                    className="bg-destructive text-white hover:bg-destructive/90">
                    Хасах
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );
}
