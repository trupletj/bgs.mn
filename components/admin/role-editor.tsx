// components/admin/role-editor.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { getProfileIdFromAuthUserId } from "@/actions/profile";

interface Permission {
  id: number;
  module: string;
  action: string;
  description: string;
}

interface Role {
  id?: number;
  name: string;
  display_name: string;
  description: string;
}

interface RoleEditorProps {
  roleId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RoleEditor({ roleId, onSuccess, onCancel }: RoleEditorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [formData, setFormData] = useState<Role>({
    name: "",
    display_name: "",
    description: "",
  });

  const supabase = createClient();

  // Role ID өгөгдсөн бол мэдээллийг ачаалах
  useEffect(() => {
    if (roleId) {
      fetchRole();
      setIsEditing(true);
    }
  }, [roleId]);

  // Permissions-г ачаалах
  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchRole = async () => {
    if (!roleId) return;

    try {
      // Role мэдээлэл
      const { data: roleData, error: roleError } = await supabase
        .from("roles")
        .select("*")
        .eq("id", roleId)
        .single();

      if (roleError) throw roleError;

      if (roleData) {
        setFormData(roleData);
      }

      // Role-ийн permissions-г авах
      const { data: rolePermissions, error: permError } = await supabase
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", roleId);

      if (permError) throw permError;

      const permissionIds =
        rolePermissions?.map((rp) => rp.permission_id) || [];
      setSelectedPermissions(permissionIds);
    } catch (error) {
      toast.error("Role авахад алдаа гарлаа");
      console.error(error);
    }
  };

  const fetchPermissions = async () => {
    try {
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
      setLoadingPermissions(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePermissionToggle = (permissionId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Шалгалтууд
      if (!formData.name || !formData.display_name) {
        toast.error("Нэр талбарыг бөглөнө үү");
        return;
      }

      // if (selectedPermissions.length === 0) {
      //   toast.error("Дор хаяж нэг permission сонгоно уу");
      //   return;
      // }

      const profile_id = await getProfileIdFromAuthUserId();

      if (isEditing && roleId) {
        // Edit mode - update хийх
        // 1. Role мэдээллийг шинэчлэх
        const { error: roleError } = await supabase
          .from("roles")
          .update({
            display_name: formData.display_name,
            description: formData.description,
          })
          .eq("id", roleId)
          .select()
          .single();

        if (roleError) throw roleError;

        // 2. Permissions шинэчлэх
        // Хуучин permissions-г устгах
        await supabase.from("role_permissions").delete().eq("role_id", roleId);

        // Шинэ permissions-г нэмэх
        const rolePermissions = selectedPermissions.map((permissionId) => ({
          role_id: roleId,
          permission_id: permissionId,
          assigned_by: profile_id,
        }));

        const { error: permissionError } = await supabase
          .from("role_permissions")
          .insert(rolePermissions);

        if (permissionError) throw permissionError;

        toast.success("Role амжилттай шинэчлэгдлээ!");
      } else {
        // New mode - insert хийх
        // 1. Role үүсгэх
        const { data: role, error: roleError } = await supabase
          .from("roles")
          .insert({
            name: formData.name,
            display_name: formData.display_name,
            description: formData.description,
          })
          .select()
          .single();

        if (roleError) throw roleError;

        // 2. Permissions холбох
        const rolePermissions = selectedPermissions.map((permissionId) => ({
          role_id: role.id,
          permission_id: permissionId,
          assigned_by: profile_id,
        }));

        const { error: permissionError } = await supabase
          .from("role_permissions")
          .insert(rolePermissions);

        if (permissionError) throw permissionError;

        toast.success("Role амжилттай үүслээ!");

        // Form цэвэрлэх
        setFormData({
          name: "",
          display_name: "",
          description: "",
        });
        setSelectedPermissions([]);
      }

      // Success callback дуудах
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error("Алдаа");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Permissions-г модулаар нь бүлэглэх
  const permissionsByModule = permissions.reduce(
    (acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    },
    {} as Record<string, Permission[]>,
  );

  // Сонгогдсон permissions-ын тоо
  const selectedCount = selectedPermissions.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Role Засах" : "Шинэ Role Үүсгэх"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Role-ийн мэдээллийг засах"
            : "Шинэ role үүсгэж, permissions оноох."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Системийн нэр *</label>
              <Input
                placeholder="admin, manager, user"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                Систем дотор ашиглагдах нэр
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Харагдах нэр *</label>
              <Input
                placeholder="Админ, Менежер, Хэрэглэгч"
                value={formData.display_name}
                onChange={(e) =>
                  handleInputChange("display_name", e.target.value)
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Хэрэглэгчдэд харагдах нэр
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Тайлбар</label>
            <Textarea
              placeholder="Энэ role-ийн үүрэг, хариуцлага..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Role-ийн дэлгэрэнгүй тайлбар
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="text-sm font-medium">Permissions *</label>
                  <p className="text-sm text-muted-foreground">
                    Энэ role-д олгох permissions-г сонгоно уу
                  </p>
                </div>
                <Badge variant="secondary">{selectedCount} сонгогдсон</Badge>
              </div>

              {loadingPermissions ? (
                <div className="text-sm text-muted-foreground">
                  Permissions ачаалж байна...
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
                  {Object.entries(permissionsByModule).map(
                    ([module, modulePermissions]) => (
                      <div
                        key={module}
                        className="border-b last:border-b-0 pb-4 last:pb-0">
                        <h4 className="font-medium mb-3 capitalize text-sm flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {module}
                          </Badge>
                          <span className="text-muted-foreground">
                            ({modulePermissions.length})
                          </span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {modulePermissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-center space-x-2">
                              <Checkbox
                                id={`permission-${permission.id}`}
                                checked={selectedPermissions.includes(
                                  permission.id,
                                )}
                                onCheckedChange={() =>
                                  handlePermissionToggle(permission.id)
                                }
                              />
                              <label
                                htmlFor={`permission-${permission.id}`}
                                className="text-sm font-normal leading-none cursor-pointer flex-1">
                                <div className="text-xs text-muted-foreground">
                                  {permission.module}.{permission.action}
                                </div>
                                {permission.description && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    {permission.description}
                                  </div>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="gap-2 pt-4 border-t">
            <Button
              type="submit"
              disabled={isLoading || loadingPermissions}
              className="flex-1">
              {isLoading
                ? isEditing
                  ? "Хадгалж байна..."
                  : "Үүсгэж байна..."
                : isEditing
                  ? "Хадгалах"
                  : "Role Үүсгэх"}
            </Button>

            {onCancel && (
              <Button
                type="button"
                variant="outline"
                className="ml-2"
                onClick={handleCancel}>
                Болих
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
