"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewsForm } from "@/components/news/news-form";
import { deleteNews, togglePublish, type NewsRow } from "@/actions/news";

interface NewsManagerProps {
  initialNews: NewsRow[];
  perms: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function NewsManager({ initialNews, perms }: NewsManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsRow | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<NewsRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(row: NewsRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  function onDone() {
    setDialogOpen(false);
    setEditing(undefined);
    router.refresh();
  }

  async function onTogglePublish(row: NewsRow) {
    setBusyId(row.id);
    const result = await togglePublish(row.id, row.publishedAt === null);
    setBusyId(null);
    if (result.ok) {
      toast.success(row.publishedAt === null ? "Нийтэллээ" : "Ноорог болголоо");
      router.refresh();
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    const result = await deleteNews(deleteTarget.id);
    setDeleteTarget(null);
    if (result.ok) {
      toast.success("Мэдээ устгагдлаа");
      router.refresh();
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">Мэдээний жагсаалт</h2>
        <div className="h-px flex-1 bg-border" />
        {perms.canCreate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Мэдээ нэмэх
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Гарчиг</TableHead>
              <TableHead className="w-28">Төлөв</TableHead>
              <TableHead className="w-32">Үүсгэсэн</TableHead>
              <TableHead className="w-32 text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialNews.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Мэдээ алга байна.
                </TableCell>
              </TableRow>
            ) : (
              initialNews.map((row) => {
                const published = row.publishedAt !== null;
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {row.description}
                      </div>
                    </TableCell>
                    <TableCell>
                      {published ? (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                          Нийтэлсэн
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-amber-100 text-amber-700">
                          Ноорог
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {perms.canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={busyId === row.id}
                                onClick={() => onTogglePublish(row)}
                              >
                                {published ? (
                                  <EyeOff className="size-4" />
                                ) : (
                                  <Eye className="size-4" />
                                )}
                                <span className="sr-only">
                                  {published ? "Ноорог болгох" : "Нийтлэх"}
                                </span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {published ? "Ноорог болгох" : "Нийтлэх"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {perms.canEdit && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                                <Pencil className="size-4" />
                                <span className="sr-only">Засах</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Засах</TooltipContent>
                          </Tooltip>
                        )}
                        {perms.canDelete && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                                <span className="sr-only">Устгах</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Устгах</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Мэдээ засах" : "Шинэ мэдээ"}</DialogTitle>
          </DialogHeader>
          <NewsForm initial={editing} onDone={onDone} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Мэдээ устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; устгагдана. Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
