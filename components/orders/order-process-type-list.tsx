// components/order-process/OrderProcessList.tsx
"use client";

import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteOrderProcess } from "@/actions/order-process";
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

interface OrderProcess {
  id: number;
  name: string;
  created_at: string;
  is_deleted: boolean;
}

interface OrderProcessListProps {
  initialProcesses: OrderProcess[];
}

export default function OrderProcessList({
  initialProcesses,
}: OrderProcessListProps) {
  const [processes, setProcesses] = useState<OrderProcess[]>(initialProcesses);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<OrderProcess | null>(
    null
  );
  const router = useRouter();

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padEnd(2, "0");
    const day = String(date.getDate()).padEnd(2, "0");

    return `${year} он ${month} сар ${day} өдөр`;
  }

  const handleDelete = async (processId: number) => {
    if (!processToDelete) return;

    try {
      setLoading(true);
      const result = await deleteOrderProcess(processId);

      if (result.success) {
        toast.success(`${processToDelete.name} төрөл амжилттай устгагдлаа.`);
        setProcesses(processes.filter((p) => p.id !== processId));
      } else {
        toast.error(`Алдаа гарлаа: ${result.error}`);
      }
    } catch (error) {
      toast.error("Алдаа гарлаа: " + (error as Error).message);
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setProcessToDelete(null);
    }
  };

  const confirmDelete = (process: OrderProcess) => {
    setProcessToDelete(process);
    setDeleteDialogOpen(true);
  };

  const handleEdit = (processId: number) => {
    router.push(`/order-processes/${processId}/edit`);
  };

  const handleView = (processId: number) => {
    router.push(`/order-processes/${processId}`);
  };

  return (
    <>
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Үүсгэсэн огноо</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-[100px] text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="text-muted-foreground">
                    Захиалгын төрөл олдсонгүй
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/order-processes/create")}>
                    Эхний төрөл үүсгэх
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              processes.map((process, index) => (
                <TableRow key={process.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{process.name}</div>
                  </TableCell>
                  <TableCell>{formatDate(process.created_at)}</TableCell>
                  <TableCell>
                    {process.is_deleted ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Устгагдсан
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Идэвхтэй
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleView(process.id)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Дэлгэрэнгүй
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEdit(process.id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Засах
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => confirmDelete(process)}
                          className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Устгах
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Захиалгын төрөл устгах</AlertDialogTitle>
            <AlertDialogDescription>
              Та "{processToDelete?.name}" захиалгын төрлийг устгахдаа итгэлтэй
              байна уу? Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Цуцлах</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                processToDelete && handleDelete(processToDelete.id)
              }
              disabled={loading}
              className="bg-red-600 hover:bg-red-700">
              {loading ? "Устгаж байна..." : "Устгах"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
