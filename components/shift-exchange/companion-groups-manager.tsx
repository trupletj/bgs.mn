"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, X, Users, Briefcase, Phone } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { UserSearchPicker } from "@/components/users/user-search-picker";
import {
  addCompanionMembers,
  createCompanionGroup,
  deleteCompanionGroup,
  removeCompanionMember,
} from "@/actions/shift-exchange";
import { BusyIndicator } from "@/components/ui/page-loader";
import type { CompanionGroup } from "@/types/shift-exchange";

export function CompanionGroupsManager({
  groups,
}: {
  groups: CompanionGroup[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  // нэг хүн нэг л бүлэгт — бүх бүлгийн гишүүдийг picker-ээс хасна
  const allMemberIds = useMemo(
    () => groups.flatMap((g) => g.members.map((m) => m.userId)),
    [groups],
  );

  const create = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createCompanionGroup(newName);
      if (res.ok) {
        toast.success("Бүлэг үүслээ");
        setNewName("");
        router.refresh();
      } else toast.error(res.error);
    });
  };

  const addMember = (groupId: number, userId: string) =>
    startTransition(async () => {
      const res = await addCompanionMembers(groupId, [userId]);
      if (res.ok) {
        if (res.added > 0) toast.success("Нэмэгдлээ");
        else toast.error("Энэ хүн өөр бүлэгт байна");
        router.refresh();
      } else toast.error(res.error);
    });

  const removeMember = (memberId: number) =>
    startTransition(async () => {
      const res = await removeCompanionMember(memberId);
      if (res.ok) {
        toast.success("Хаслаа");
        router.refresh();
      } else toast.error(res.error);
    });

  const removeGroup = (id: number) =>
    startTransition(async () => {
      const res = await deleteCompanionGroup(id);
      if (res.ok) {
        toast.success("Бүлэг устлаа");
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-4">
      <BusyIndicator busy={pending} />
      <Card className="flex flex-row flex-wrap items-end gap-2 p-4">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">
            Шинэ бүлгийн нэр
          </label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Жишээ: Батын гэр бүл / Дарханы найзууд"
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
        </div>
        <Button disabled={pending || !newName.trim()} onClick={create}>
          <Plus className="h-4 w-4" />
          Бүлэг үүсгэх
        </Button>
      </Card>

      {groups.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Бүлэг алга</p>
          <p className="text-sm text-muted-foreground">
            Хамт явах хүмүүсийг нэг бүлэгт нэгтгэвэл ухаалаг хуваарилалт тэднийг
            нэг автобусанд хадгална.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {groups.map((g) => (
            <Card key={g.id} className="gap-3 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">{g.name}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {g.members.length}
                </Badge>
                <div className="flex-1" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={pending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>«{g.name}» бүлгийг устгах уу?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Бүлэг устах ба гишүүд хамтрах холбоогоо алдана.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Болих</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeGroup(g.id)}
                        className="bg-destructive text-white hover:bg-destructive/90">
                        Устгах
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <ul className="flex flex-col gap-1.5">
                {g.members.map((m) => (
                  <li
                    key={m.memberId}
                    className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {m.displayName}
                      </p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {m.positionName && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3 shrink-0" />
                            {m.positionName}
                          </span>
                        )}
                        {m.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 shrink-0" />
                            {m.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => removeMember(m.memberId)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              <UserSearchPicker
                placeholder="Гишүүн нэмэх (нэр, утсаар хайх)..."
                excludeIds={allMemberIds}
                disabled={pending}
                onSelect={(u) => addMember(g.id, u.id)}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
