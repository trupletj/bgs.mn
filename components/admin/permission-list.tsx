// components/admin/permissions-list.tsx (шинэчлэгдсэн)
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Button } from "../ui/button";
import { PermissionEditor } from "./permission-editor";

interface Permission {
  id: number;
  name: string;
  display_name: string;
  description: string;
  module: string;
  action: string;
  created_at: string;
}

export function PermissionsList() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPermission, setEditingPermission] = useState<number | null>(
    null
  );
  const [showEditor, setShowEditor] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("module")
        .order("action");

      if (error) throw error;

      setPermissions(data || []);
    } catch (error) {
      toast.error("Permissions авахад алдаа гарлаа");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deletePermission = async (permission_id: number, name: string) => {
    if (!confirm(`"${name}" permission-г устгахдаа итгэлтэй байна уу?`)) {
      return;
    }

    try {
      const { error: permissionError } = await supabase
        .from("permissions")
        .delete()
        .eq("id", permission_id);

      if (permissionError) throw permissionError;

      toast.success("Permission амжилттай устгагдлаа");
      fetchPermissions();
    } catch (error) {
      toast.error("Permission устгахад алдаа гарлаа");
      console.error(error);
    }
  };

  const handleEdit = (permissionId: number) => {
    setEditingPermission(permissionId);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingPermission(null);
    setShowEditor(true);
  };

  const handleEditorSuccess = () => {
    setShowEditor(false);
    setEditingPermission(null);
    fetchPermissions();
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingPermission(null);
  };

  if (showEditor) {
    return (
      <PermissionEditor
        permissionId={editingPermission || undefined}
        onSuccess={handleEditorSuccess}
        onCancel={handleEditorCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Ачаалж байна...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Permissions Жагсаалт</CardTitle>
            <CardDescription>
              Бүх permissions болон тэдгээрийн мэдээлэл
            </CardDescription>
          </div>
          <Button onClick={handleNew}>Шинэ Permission</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Модуль</TableHead>
                <TableHead>Үйлдэл</TableHead>
                <TableHead>Тайлбар</TableHead>
                <TableHead>Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell>
                    <Badge variant="secondary">{permission.module}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{permission.action}</Badge>
                  </TableCell>

                  <TableCell>{permission.description || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(permission.id)}>
                        Засах
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          deletePermission(permission.id, permission.name)
                        }>
                        Устгах
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {permissions.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              Permission байхгүй байна
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
