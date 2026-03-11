"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  User,
  Phone,
  Key,
  Loader2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export function ChefManager({ hallId }: { hallId: number }) {
  const [chefs, setChefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ name: "", phone: "", pin: "" });
  const [formData, setFormData] = useState({ name: "", phone: "", pin: "" });
  const supabase = createClient();

  useEffect(() => {
    fetchChefs();
  }, [hallId]);

  async function fetchChefs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("chefs")
      .select("*")
      .eq("dining_hall_id", hallId)
      .order("created_at", { ascending: false });

    if (error) toast.error("Тогооч нарын мэдээллийг татахад алдаа гарлаа");
    setChefs(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!formData.name || !formData.phone || formData.pin.length !== 4) {
      return toast.error("Мэдээллээ бүрэн оруулна уу (PIN 4 орон)");
    }
    const { error } = await supabase
      .from("chefs")
      .insert([{ ...formData, dining_hall_id: hallId }]);

    if (error) return toast.error(error.message);

    toast.success("Тогооч нэмэгдлээ");
    setFormData({ name: "", phone: "", pin: "" });
    setIsAdding(false);
    fetchChefs();
  }

  async function handleUpdate(id: number) {
    if (!editData.name || !editData.phone || editData.pin.length !== 4) {
      return toast.error("Мэдээлэл дутуу байна (PIN 4 орон)");
    }

    const { error } = await supabase
      .from("chefs")
      .update({
        name: editData.name,
        phone: editData.phone,
        pin: editData.pin,
      })
      .eq("id", id);

    if (error) return toast.error(error.message);

    toast.success("Мэдээлэл шинэчлэгдлээ");
    setEditingId(null);
    fetchChefs();
  }

  async function handleDelete(id: number) {
    if (!confirm("Устгахдаа итгэлтэй байна уу?")) return;
    const { error } = await supabase.from("chefs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    fetchChefs();
  }

  const startEditing = (chef: any) => {
    setEditingId(chef.id);
    setEditData({ name: chef.name, phone: chef.phone, pin: chef.pin });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Тогооч нарын жагсаалт</h3>
        <Button
          onClick={() => {
            setIsAdding(!isAdding);
            setEditingId(null);
          }}
          variant={isAdding ? "outline" : "default"}>
          {isAdding ? (
            "Цуцлах"
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" /> Нэмэх
            </>
          )}
        </Button>
      </div>

      {isAdding && (
        <Card className="bg-blue-50/50 border-dashed border-blue-200">
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Нэр"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <Input
              placeholder="Утас"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
            <Input
              placeholder="PIN (4 орон)"
              maxLength={4}
              value={formData.pin}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  pin: e.target.value.replace(/\D/g, ""),
                })
              }
            />
            <Button onClick={handleAdd}>Хадгалах</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid gap-3">
          {chefs.map((chef) => (
            <Card
              key={chef.id}
              className={`transition-all ${editingId === chef.id ? "ring-2 ring-blue-500 shadow-md" : "hover:bg-slate-50"}`}>
              <CardContent className="p-4">
                {editingId === chef.id ? (
                  // EDIT MODE
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      size={1}
                      value={editData.name}
                      onChange={(e) =>
                        setEditData({ ...editData, name: e.target.value })
                      }
                      className="bg-white"
                    />
                    <Input
                      value={editData.phone}
                      onChange={(e) =>
                        setEditData({ ...editData, phone: e.target.value })
                      }
                      className="bg-white"
                    />
                    <Input
                      maxLength={4}
                      value={editData.pin}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          pin: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className="bg-white"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => handleUpdate(chef.id)}>
                        <Check className="w-4 h-4 mr-1" /> OK
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setEditingId(null)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  // VIEW MODE
                  <div className="flex justify-between items-center">
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <User className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-700">
                          {chef.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{chef.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Key className="w-4 h-4 text-slate-400" />
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                          ****
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditing(chef)}
                        className="text-slate-400 hover:text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(chef.id)}
                        className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {chefs.length === 0 && !isAdding && (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
              Тогооч бүртгэгдээгүй байна
            </div>
          )}
        </div>
      )}
    </div>
  );
}
