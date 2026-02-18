"use client";

import { useState } from "react";
import { Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMealOverride } from "@/actions/meal-override";
import { toast } from "sonner";

export function EditOverrideDialog({
  override,
  diningHalls,
}: {
  override: any;
  diningHalls: any[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState({
    meal_type: override.meal_type,
    dining_hall_id: override.dining_hall_id.toString(),
    note: override.note || "",
  });

  async function handleUpdate() {
    setLoading(true);
    try {
      await updateMealOverride(override.id, values);
      toast.success("Амжилттай шинэчлэгдлээ");
      setOpen(false);
    } catch (e) {
      toast.error("Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{override.users?.nice_name} - Засах</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Хоолны төрөл</Label>
            <Select
              value={values.meal_type}
              onValueChange={(v) => setValues({ ...values, meal_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Өглөөний цай</SelectItem>
                <SelectItem value="morning_meal">Өглөөний хоол</SelectItem>
                <SelectItem value="lunch">Өдөр</SelectItem>
                <SelectItem value="dinner">Орой</SelectItem>
                <SelectItem value="nightmeal">Шөнийн хоол</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Гал тогоо</Label>
            <Select
              value={values.dining_hall_id}
              onValueChange={(v) =>
                setValues({ ...values, dining_hall_id: v })
              }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {diningHalls.map((h) => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Тэмдэглэл</Label>
            <Input
              value={values.note}
              onChange={(e) => setValues({ ...values, note: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Цуцлах
          </Button>
          <Button onClick={handleUpdate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Хадгалах
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
