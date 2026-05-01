"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { requestAutobusSeat } from "@/actions/eelj";
import type { RequestableAutobus } from "@/types/eelj";

function formatDayDate(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RequestDialog({ options }: { options: RequestableAutobus[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [comment, setComment] = useState("");
  const [pending, startTransition] = useTransition();

  const available = options.filter((o) => !o.alreadyRequested);

  const onSubmit = () => {
    if (!selected) {
      toast.error("Автобусаа сонгоно уу");
      return;
    }
    const opt = available.find(
      (o) => `${o.eeljId}:${o.autobusId}` === selected,
    );
    if (!opt) return;

    const fd = new FormData();
    fd.set("eelj_id", String(opt.eeljId));
    fd.set("autobus_id", String(opt.autobusId));
    if (comment) fd.set("comment", comment);

    startTransition(async () => {
      const res = await requestAutobusSeat(fd);
      if (res.ok) {
        toast.success("Хүсэлт илгээгдлээ");
        setOpen(false);
        setSelected("");
        setComment("");
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Шинэ хүсэлт
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Автобусанд суух хүсэлт</DialogTitle>
          <DialogDescription>
            Ээлж + автобус сонгож, шаардлагатай бол тайлбар бичнэ үү. Машины
            ахлах хариу өгөх хүртэл &quot;Хүсэлт гаргасан&quot; статустай
            байна.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Автобус
            </label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Сонгох..." />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">
                    Боломжтой автобус алга
                  </div>
                ) : (
                  <SelectGroup>
                    <SelectLabel>Ойрын ээлжүүд</SelectLabel>
                    {available.map((o) => (
                      <SelectItem
                        key={`${o.eeljId}:${o.autobusId}`}
                        value={`${o.eeljId}:${o.autobusId}`}
                      >
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-medium">
                            {o.autobusNumber}
                            {o.directionName && ` · ${o.directionName}`}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDayDate(o.dayDate)} ·{" "}
                            {o.isCome ? "Ирэх" : "Буух"}
                            {o.driverName && ` · ${o.driverName}`}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Тайлбар (заавал биш)
            </label>
            <Textarea
              placeholder="Жишээ: 'Сэлэнгийн талбай дээр буухыг хүсч байна'"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          {options.some((o) => o.alreadyRequested) && (
            <p className="text-[11px] text-muted-foreground">
              <Badge variant="outline" className="mr-1.5">
                {options.filter((o) => o.alreadyRequested).length}
              </Badge>
              автобусанд хүсэлт хийсэн байгаа тул жагсаалтаас хасагдсан.
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Болих</Button>
          </DialogClose>
          <Button onClick={onSubmit} disabled={pending || !selected}>
            {pending ? "Илгээж байна..." : "Илгээх"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
