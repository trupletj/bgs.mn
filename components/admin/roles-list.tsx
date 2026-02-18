"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { RoleEditor } from "./role-editor";

interface Permission {
  id: number;
  module: string;
  action: string;
}

interface RolePermission {
  permissions: Permission;
}

interface DatabaseRole {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  created_at: string;
  role_permissions: RolePermission[];
}

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  created_at: string;
  permissions: Permission[];
}

export function RolesList() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const supabase = createClient();

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("roles")
        .select(
          `
          *,
          role_permissions (
            permissions (
              id,
              module,
              action
            )
          )
        `,
        )
        .order("display_name");

      if (error) throw error;

      // Type-safe хувиргалт
      const formattedRoles: Role[] = (data || []).map((role: DatabaseRole) => ({
        id: role.id,
        name: role.name,
        display_name: role.display_name,
        description: role.description,
        created_at: role.created_at,
        permissions:
          role.role_permissions
            ?.map((rp: RolePermission) => rp.permissions)
            .filter((p): p is Permission => p !== null) || [],
      }));

      setRoles(formattedRoles);
    } catch (err) {
      console.error("Role fetch error:", err);
      toast.error("Role-уудыг ачаалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const deleteRole = async (roleId: number, roleName: string) => {
    if (!confirm(`"${roleName}" role-г устгахдаа итгэлтэй байна уу?`)) return;

    try {
      const { error: permError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);
      if (permError) throw permError;

      const { error: profError } = await supabase
        .from("roles_profiles")
        .delete()
        .eq("role_id", roleId);
      if (profError) throw profError;

      const { error: roleError } = await supabase
        .from("roles")
        .delete()
        .eq("id", roleId);
      if (roleError) throw roleError;

      toast.success(`${roleName} role амжилттай устлаа`);
      fetchRoles();
    } catch (err) {
      console.error("Delete role error:", err);
      toast.error("Role устгахад алдаа гарлаа");
    }
  };

  const handleEdit = (roleId: number) => {
    setEditingRole(roleId);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingRole(null);
    setShowEditor(true);
  };

  const handleEditorSuccess = () => {
    setShowEditor(false);
    setEditingRole(null);
    fetchRoles();
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingRole(null);
  };

  if (showEditor) {
    return (
      <RoleEditor
        roleId={editingRole || undefined}
        onSuccess={handleEditorSuccess}
        onCancel={handleEditorCancel}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-10">
          <div className="text-center text-muted-foreground">
            Ачаалж байна...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Role-уудын жагсаалт</CardTitle>
            <CardDescription>
              Нийт {roles.length} role бүртгэлтэй
            </CardDescription>
          </div>
          <Button onClick={handleNew}>Шинэ Role Үүсгэх</Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Харагдах нэр</TableHead>
                <TableHead>Системийн нэр</TableHead>
                <TableHead>Тайлбар</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground">
                    Role байхгүй байна
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      {role.display_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {role.name}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p
                        className="truncate"
                        title={role.description || undefined}>
                        {role.description || "-"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {role.permissions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Permission байхгүй
                          </span>
                        ) : (
                          <>
                            {role.permissions.slice(0, 4).map((p) => (
                              <Badge
                                key={p.id}
                                variant="outline"
                                className="text-xs">
                                {p.module}:{p.action}
                              </Badge>
                            ))}
                            {role.permissions.length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{role.permissions.length - 4}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(role.id)}>
                          Засах
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            deleteRole(role.id, role.display_name)
                          }>
                          Устгах
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
