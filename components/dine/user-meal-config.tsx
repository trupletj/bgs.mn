"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Edit2, Save, X, Utensils } from "lucide-react";

interface MealConfigProps {
  userId: string;
  canEdit: boolean;
}

export function UserMealConfig({ userId, canEdit }: MealConfigProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [diningHalls, setDiningHalls] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    breakfast_location: "",
    lunch_location: "",
    dinner_location: "",
    night_meal_location: "",
    morning_meal_location: "",
  });

  useEffect(() => {
    fetchInitialData();
  }, [userId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Гал тогоонуудын жагсаалт авах
      const { data: halls } = await supabase.from("dining_hall").select("*");
      setDiningHalls(halls || []);

      const { data: userConfig, error } = await supabase
        .from("user_meal_configs")
        .select(
          `
          *,
          breakfast:breakfast_location(name),
          lunch:lunch_location(name),
          dinner:dinner_location(name),
          night:night_meal_location(name),
          morning:morning_meal_location(name)
        `,
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (userConfig) {
        setConfig(userConfig);
        setFormData({
          breakfast_location: userConfig.breakfast_location?.toString() || "",
          lunch_location: userConfig.lunch_location?.toString() || "",
          dinner_location: userConfig.dinner_location?.toString() || "",
          night_meal_location: userConfig.night_meal_location?.toString() || "",
          morning_meal_location:
            userConfig.morning_meal_location?.toString() || "",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      user_id: userId,
      breakfast_location: formData.breakfast_location
        ? parseInt(formData.breakfast_location)
        : null,
      lunch_location: formData.lunch_location
        ? parseInt(formData.lunch_location)
        : null,
      dinner_location: formData.dinner_location
        ? parseInt(formData.dinner_location)
        : null,
      night_meal_location: formData.night_meal_location
        ? parseInt(formData.night_meal_location)
        : null,
      morning_meal_location: formData.morning_meal_location
        ? parseInt(formData.morning_meal_location)
        : null,
    };

    const { error } = await supabase
      .from("user_meal_configs")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      toast.error("Алдаа гарлаа: " + error.message);
    } else {
      toast.success("Хоолны тохиргоо хадгалагдлаа");
      setIsEditing(false);
      fetchInitialData();
    }
    setLoading(false);
  };

  if (loading && !isEditing)
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="animate-spin" />
      </div>
    );

  const mealTypes = [
    {
      key: "breakfast_location",
      label: "Өглөөний цай",
      display: config?.breakfast?.name,
    },
    {
      key: "lunch_location",
      label: "Өдрийн хоол",
      display: config?.lunch?.name,
    },
    {
      key: "dinner_location",
      label: "Оройн хоол",
      display: config?.dinner?.name,
    },
    {
      key: "night_meal_location",
      label: "Шөнийн хоол",
      display: config?.night?.name,
    },
    {
      key: "morning_meal_location",
      label: "Өглөөний хоол",
      display: config?.morning?.name,
    },
  ];

  // ... (Дээд талын import болон логик хэсэг хэвээрээ)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium flex items-center gap-2 text-sm">
          <Utensils className="h-4 w-4 text-primary shrink-0" />
          <span>Хоолны байршлын тохиргоо</span>
        </h3>
        {!isEditing ? (
          canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" /> Засварлах
            </Button>
          )
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}>
              <X className="h-4 w-4 mr-2" /> Цуцлах
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" /> Хадгалах
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mealTypes
          // ЗӨВХӨН ЭНЭ ХЭСГИЙГ ӨӨРЧЛӨВ:
          // Засварлаж байгаа бол бүгдийг харуулна,
          // Харах горимд бол зөвхөн 'display' утгатай (оноосон) талбарыг харуулна.
          .filter((meal) => isEditing || meal.display)
          .map((meal) => (
            <div
              key={meal.key}
              className="p-4 border rounded-lg bg-card animate-in fade-in duration-300">
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                {meal.label}
              </label>

              {isEditing ? (
                <Select
                  value={formData[meal.key as keyof typeof formData] || "none"}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      [meal.key]: val === "none" ? "" : val,
                    })
                  }>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Гал тогоо сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Сонгохгүй</SelectItem>
                    {diningHalls.map((hall) => (
                      <SelectItem key={hall.id} value={hall.id.toString()}>
                        {hall.name} ({hall.location})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-semibold text-foreground">{meal.display}</p>
              )}
            </div>
          ))}

        {/* Хэрэв нэг ч хоолны тохиргоо байхгүй бол харах горимд мэдэгдэл харуулах */}
        {!isEditing && mealTypes.filter((m) => m.display).length === 0 && (
          <div className="col-span-full py-8 text-center border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground text-sm italic">
              Хоолны байршлын тохиргоо бүртгэгдээгүй байна.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
