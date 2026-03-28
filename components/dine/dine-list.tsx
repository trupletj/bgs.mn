"use client";

import React, { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  MapPin,
  Settings,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function DineList({ is_boss }: { is_boss: boolean }) {
  const supabase = createClient();

  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    location: "",
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const router = useRouter();

  const fetchData = async () => {
    try {
      const { data: halls, error } = await supabase
        .from("dining_hall")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setData(halls || []);
    } catch (error: any) {
      toast.error("Дата татахад алдаа гарлаа: " + error.message);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.name) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("dining_hall").upsert({
        ...(formData.id ? { id: formData.id } : {}),
        name: formData.name,
        location: formData.location,
      });

      if (error) throw error;

      toast.success(
        formData.id ? "Амжилттай засагдлаа" : "Амжилттай нэмэгдлээ",
      );
      setIsDialogOpen(false);
      setFormData({ id: null, name: "", location: "" });
      fetchData();
    } catch (error: any) {
      toast.error("Алдаа гарлаа: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("dining_hall")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;

      toast.success("Амжилттай устгагдлаа");
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error("Устгахад алдаа гарлаа: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Хайлт (Client-side)
  const filteredData = useMemo(() => {
    return data.filter(
      (item) =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [data, searchTerm]);

  const openEditDialog = (item: any) => {
    setFormData({ id: item.id, name: item.name, location: item.location });
    setIsDialogOpen(true);
  };

  const totalColumns = is_boss ? 5 : 4;

  return (
    <div className="mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Хоолны танхимууд</h1>
          <p className="text-muted-foreground mt-2">
            Нийт {filteredData.length} танхим бүртгэлтэй байна
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setFormData({ id: null, name: "", location: "" })}>
              <Plus className="mr-2 h-4 w-4" /> Танхим нэмэх
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {formData.id ? "Танхим засах" : "Шинэ танхим нэмэх"}
              </DialogTitle>
              <DialogDescription>
                Гал тогоо болон хоолны танхимын мэдээллийг энд оруулна уу.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Танхимын нэр</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Жишээ: Төв гал тогоо"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Байршил</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="Жишээ: А блок, 1 давхар"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={loading}>
                Цуцлах
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !formData.name}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Хадгалах
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Нэрээр хайх..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[60px] text-center">№</TableHead>
              <TableHead className="min-w-[200px]">Танхимын нэр</TableHead>
              <TableHead className="w-[30%]">Байршил</TableHead>
              <TableHead className="w-[150px]">Огноо</TableHead>
              {is_boss && (
                <TableHead className="w-[100px] text-right">Үйлдэл</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialLoading ? (
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  className="text-center py-20 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span>Ачаалж байна...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  className="text-center py-20 text-muted-foreground">
                  Мэдээлэл олдсонгүй
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item, index) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-center font-medium text-slate-500">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div
                      className="font-semibold text-slate-900 cursor-pointer hover:text-blue-600 hover:underline transition-all"
                      onClick={() => router.push(`/dine/${item.id}/employee`)}>
                      {item.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm text-slate-600">
                      <MapPin className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {item.location || "Тэмдэглэгдээгүй"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <div className="flex items-center">
                      {item.created_at
                        ? format(new Date(item.created_at), "yyyy-MM-dd")
                        : "-"}
                    </div>
                  </TableCell>
                  {is_boss && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuItem
                            onClick={() => openEditDialog(item)}>
                            <Edit className="mr-2 h-4 w-4" /> Засах
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push("/dine/" + item.id)}>
                            <Settings className="mr-2 h-4 w-4" /> Тохиргоо
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteDialogOpen(true);
                            }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Устгах
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Устгахдаа итгэлтэй байна уу?</AlertDialogTitle>
            <AlertDialogDescription>
              "{itemToDelete?.name}" танхимыг устгах гэж байна. Энэ үйлдлийг
              буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Цуцлах</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={loading}>
              {loading ? "Устгаж байна..." : "Устгах"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
