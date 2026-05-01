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
  { value: "night_meal", label: "Шөнийн хоол" },
];

export function TimeSlotManager({ hallId }: { hallId: number }) {
  const [slots, setSlots] = useState<any[]>([]);
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

  const addNewSlot = () => {
    setSlots([
      ...slots,
      {
        meal_type: "lunch",
        start_time: "12:00:00",
        end_time: "14:00:00",
        isNew: true,
      },
    ]);
  };

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

  return (
    <div className="space-y-4 w-full mx-auto">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Цагийн хуваарь
        </h3>
        <Button variant="outline" size="sm" onClick={addNewSlot}>
          <Plus className="w-4 h-4 mr-1" /> Нэмэх
        </Button>
      </div>

      <div className="grid gap-3 p-1">
        {slots.map((slot, index) => (
          <SlotItem
            key={slot.id || `new-${index}`}
            slot={slot}
            hallId={hallId}
            onDelete={() => fetchSlots()}
            onSaved={() => fetchSlots()}
            onCancelNew={() => setSlots(slots.filter((_, i) => i !== index))}
          />
        ))}
      </div>
    </div>
  );
}

function SlotItem({ slot, hallId, onSaved, onDelete, onCancelNew }: any) {
  const [currentSlot, setCurrentSlot] = useState(slot);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const parseTime = (timeStr: string) => {
    if (!timeStr) return { h: "08", m: "00" };
    const parts = timeStr.split(":");
    return { h: parts[0] || "08", m: parts[1] || "00" };
  };

  const updateLocalTime = (
    type: "start" | "end",
    unit: "h" | "m",
    value: string,
  ) => {
    const timeValue =
      type === "start" ? currentSlot.start_time : currentSlot.end_time;
    const current = parseTime(timeValue);
    if (unit === "h") current.h = value;
    else current.m = value;

    const finalTime = `${current.h}:${current.m}:00`;
    setCurrentSlot({
      ...currentSlot,
      [type === "start" ? "start_time" : "end_time"]: finalTime,
    });
  };

  async function handleSave() {
    setLoading(true);
    const payload = {
      meal_type: currentSlot.meal_type,
      start_time: currentSlot.start_time,
      end_time: currentSlot.end_time,
      dining_hall_id: hallId,
      is_active: true,
    };

    const { error } = currentSlot.id
      ? await supabase
          .from("meal_time_slots")
          .update(payload)
          .eq("id", currentSlot.id)
      : await supabase.from("meal_time_slots").insert(payload);

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Амжилттай хадгалагдлаа");
      onSaved();
    }
  }

  const start = parseTime(currentSlot.start_time);
  const end = parseTime(currentSlot.end_time);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="w-full md:flex-1 space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              Хоолны төрөл
            </span>
            <Select
              value={currentSlot.meal_type}
              onValueChange={(v) =>
                setCurrentSlot({ ...currentSlot, meal_type: v })
              }>
              <SelectTrigger className="h-10">
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

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Эхлэх
              </span>
              <div className="flex gap-1 items-center">
                <TimePicker
                  value={start.h}
                  options={HOURS}
                  onChange={(v) => updateLocalTime("start", "h", v)}
                />
                <span className="text-slate-300">:</span>
                <TimePicker
                  value={start.m}
                  options={MINUTES}
                  onChange={(v) => updateLocalTime("start", "m", v)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Дуусах
              </span>
              <div className="flex gap-1 items-center">
                <TimePicker
                  value={end.h}
                  options={HOURS}
                  onChange={(v) => updateLocalTime("end", "h", v)}
                />
                <span className="text-slate-300">:</span>
                <TimePicker
                  value={end.m}
                  options={MINUTES}
                  onChange={(v) => updateLocalTime("end", "m", v)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <Button
              className="flex-1 md:w-10 bg-blue-600"
              onClick={handleSave}
              disabled={loading}>
              <Save className="w-4 h-4 md:mr-0 mr-2" />
              <span className="md:hidden">Хадгалах</span>
            </Button>
            <Button
              variant="ghost"
              className="text-red-500"
              onClick={async () => {
                if (currentSlot.id) {
                  if (confirm("Устгах уу?")) {
                    const { error } = await supabase
                      .from("meal_time_slots")
                      .delete()
                      .eq("id", currentSlot.id);
                    if (!error) onDelete();
                  }
                } else {
                  onCancelNew();
                }
              }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
