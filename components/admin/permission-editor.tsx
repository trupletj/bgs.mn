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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

interface Permission {
  id?: number;
  description: string;
  module: string;
  action: string;
}

interface PermissionEditorProps {
  permissionId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Урьдчилсан модуль болон үйлдлүүд
const MODULE_OPTIONS = [
  "job_description",
  "policy",
  "order",
  "user",
  "role",
  "permission",
];

const ACTION_OPTIONS = ["read", "create", "edit", "delete"];

export function PermissionEditor({
  permissionId,
  onSuccess,
  onCancel,
}: PermissionEditorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Permission>({
    description: "",
    module: "",
    action: "",
  });

  const supabase = createClient();

  // Permission ID өгөгдсөн бол мэдээллийг ачаалах
  useEffect(() => {
    if (permissionId) {
      fetchPermission();
      setIsEditing(true);
    }
  }, [permissionId]);

  const fetchPermission = async () => {
    if (!permissionId) return;

    try {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .eq("id", permissionId)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (error) {
      toast.error("Permission авахад алдаа гарлаа");
      console.error(error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Module болон Action өөрчлөгдөхөд name автоматаар үүсгэх
    if (
      (field === "module" || field === "action") &&
      formData.module &&
      formData.action &&
      !isEditing
    ) {
      const name = `${formData.module}.${formData.action}`;
      setFormData((prev) => ({ ...prev, name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Шалгалтууд
      if (!formData.module || !formData.action) {
        toast.error("Бүх талбарыг бөглөнө үү");
        return;
      }

      if (isEditing && permissionId) {
        // Edit mode - update хийх
        const { error } = await supabase
          .from("permissions")
          .update({
            description: formData.description,
            module: formData.module,
            action: formData.action,
          })
          .eq("id", permissionId)
          .select()
          .single();

        if (error) throw error;

        toast.success("Permission амжилттай шинэчлэгдлээ!");
      } else {
        // New mode - insert хийх
        const { data, error } = await supabase
          .from("permissions")
          .insert({
            description: formData.description,
            module: formData.module,
            action: formData.action,
          })
          .select()
          .single();

        if (error) throw error;

        toast.success("Permission амжилттай үүслээ!");
      }

      // Form цэвэрлэх
      if (!isEditing) {
        setFormData({
          description: "",
          module: "",
          action: "",
        });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditing ? "Permission Засах" : "Шинэ Permission Үүсгэх"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? "Permission-ийн мэдээллийг засах"
            : "Системд шинэ эрх үүсгэх. Permission нь module.action форматаар үүснэ."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Модуль</label>
              <Select
                value={formData.module}
                onValueChange={(value) => handleInputChange("module", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Модуль сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((module) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Энэ permission хамаарах модуль
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Үйлдэл</label>
              <Select
                value={formData.action}
                onValueChange={(value) => handleInputChange("action", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Үйлдэл сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Зөвшөөрөгдсөн үйлдэл
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Тайлбар</label>
            <Textarea
              placeholder="Энэ permission-ийн тайлбар..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Permission-ийн дэлгэрэнгүй тайлбар
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditing
                  ? "Хадгалж байна..."
                  : "Үүсгэж байна..."
                : isEditing
                ? "Хадгалах"
                : "Permission Үүсгэх"}
            </Button>

            {onCancel && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                Болих
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
