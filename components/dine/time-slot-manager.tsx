"use client";

import { useState, useEffect } from "react";
import { Save, Trash2, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

const HOURS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, "0"),
);
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, "0"),
);

const MEAL_TYPES = [
  { value: "breakfast", label: "Өглөөний цай" },
  { value: "morning_meal", label: "Өглөөний хоол" },
  { value: "lunch", label: "Өдрийн хоол" },
  { value: "dinner", label: "Оройн хоол" },
  { value: "nightmeal", label: "Шөнийн хоол" },
];

interface Slot {}

export function TimeSlotManager({ hallId }: { hallId: number }) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchSlots();
  }, [hallId]);

  async function fetchSlots() {
    const { data } = await supabase
      .from("meal_time_slots")
      .select("*")
      .eq("dining_hall_id", hallId)
      .order("start_time", { ascending: true });
    setSlots(data || []);
  }

  const parseTime = (timeStr: string) => {
    if (!timeStr) return { h: "08", m: "00" };
    const parts = timeStr.split(":");
    return { h: parts[0] || "08", m: parts[1] || "00" };
  };

  const updateTime = (
    index: number,
    type: "start" | "end",
    unit: "h" | "m",
    value: string,
  ) => {
    const newSlots = [...slots];
    const current = parseTime(
      type === "start" ? newSlots[index].start_time : newSlots[index].end_time,
    );
    if (unit === "h") current.h = value;
    else current.m = value;
    const finalTime = `${current.h}:${current.m}:00`;
    if (type === "start") newSlots[index].start_time = finalTime;
    else newSlots[index].end_time = finalTime;
    setSlots(newSlots);
  };

  async function handleSave(slot: any) {
    setLoading(true);

    // Үндсэн дата
    const payload = {
      meal_type: slot.meal_type,
      start_time:
        slot.start_time.length === 5
          ? `${slot.start_time}:00`
          : slot.start_time,
      end_time:
        slot.end_time.length === 5 ? `${slot.end_time}:00` : slot.end_time,
      dining_hall_id: hallId,
      is_active: true,
    };

    let error;

    if (slot.id) {
      const { error: updateError } = await supabase
        .from("meal_time_slots")
        .update(payload)
        .eq("id", slot.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("meal_time_slots")
        .insert(payload);
      error = insertError;
    }

    setLoading(false);
    if (error) {
      console.error(error);
      toast.error(error.message);
    } else {
      toast.success("Амжилттай хадгалагдлаа");
      fetchSlots();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Устгах уу?")) return;
    const { error } = await supabase
      .from("meal_time_slots")
      .delete()
      .eq("id", id);
    if (error) toast.error(error.message);
    else fetchSlots();
  }

  return (
    <div className="space-y-4 w-full mx-auto">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Цагийн хуваарь
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg shadow-sm"
          onClick={() =>
            setSlots([
              ...slots,
              { meal_type: "lunch", start_time: "12:00", end_time: "14:00" },
            ])
          }>
          <Plus className="w-4 h-4 mr-1" /> Нэмэх
        </Button>
      </div>

      <div className="grid gap-3 p-1">
        {slots.map((slot, index) => {
          const start = parseTime(slot.start_time);
          const end = parseTime(slot.end_time);

          return (
            <Card
              key={slot.id || `new-${index}`}
              className="border-slate-200 shadow-sm overflow-visible">
              <CardContent className="">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                  <div className="w-full md:flex-1 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Хоолны төрөл
                    </span>
                    <Select
                      value={slot.meal_type}
                      onValueChange={(v) => {
                        const next = [...slots];
                        next[index].meal_type = v;
                        setSlots(next);
                      }}>
                      <SelectTrigger className="h-10 bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Pickers Container */}
                  <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                    {/* Start time */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Эхлэх
                      </span>
                      <div className="flex gap-1 items-center">
                        <TimePicker
                          value={start.h}
                          options={HOURS}
                          onChange={(v) => updateTime(index, "start", "h", v)}
                        />
                        <span className="text-slate-300">:</span>
                        <TimePicker
                          value={start.m}
                          options={MINUTES}
                          onChange={(v) => updateTime(index, "start", "m", v)}
                        />
                      </div>
                    </div>

                    {/* End time */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Дуусах
                      </span>
                      <div className="flex gap-1 items-center">
                        <TimePicker
                          value={end.h}
                          options={HOURS}
                          onChange={(v) => updateTime(index, "end", "h", v)}
                        />
                        <span className="text-slate-300">:</span>
                        <TimePicker
                          value={end.m}
                          options={MINUTES}
                          onChange={(v) => updateTime(index, "end", "m", v)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 w-full md:w-auto pt-2 md:pt-0">
                    <Button
                      className="flex-1 md:w-10 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleSave(slot)}
                      disabled={loading}>
                      <Save className="w-4 h-4 md:mr-0 mr-2" />
                      <span className="md:hidden">Хадгалах</span>
                    </Button>

                    <Button
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50 px-3"
                      onClick={() =>
                        slot.id
                          ? handleDelete(slot.id)
                          : setSlots(slots.filter((_, i) => i !== index))
                      }>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TimePicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[70px] h-10 font-mono text-center border-slate-300">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" className="max-h-[200px] min-w-[70px]">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="font-mono">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
