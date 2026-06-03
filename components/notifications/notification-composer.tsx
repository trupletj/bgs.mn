"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, X, Users, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import { sendNotification, type NotificationType } from "@/actions/notifications";
import type { UserSearchResult } from "@/actions/users";

type Mode = "broadcast" | "targeted";

export function NotificationComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("broadcast");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("info");
  const [selected, setSelected] = useState<UserSearchResult[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function addUser(user: UserSearchResult) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id) ? prev : [...prev, user],
    );
  }

  function removeUser(id: string) {
    setSelected((prev) => prev.filter((u) => u.id !== id));
  }

  function userLabel(u: UserSearchResult): string {
    return (
      `${u.last_name ?? ""} ${u.first_name ?? ""}`.trim() ||
      u.bteg_id ||
      u.id
    );
  }

  async function onSubmit() {
    if (!title.trim() || !message.trim()) {
      toast.error("Гарчиг ба агуулга шаардлагатай");
      return;
    }
    if (mode === "targeted" && selected.length === 0) {
      toast.error("Дор хаяж нэг ажилтан сонгоно уу");
      return;
    }

    setSubmitting(true);
    const result = await sendNotification({
      mode,
      title: title.trim(),
      message: message.trim(),
      type,
      userIds: mode === "targeted" ? selected.map((u) => u.id) : undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success(`${result.count} ажилтанд мэдэгдэл илгээгдлээ`);
      setTitle("");
      setMessage("");
      setSelected([]);
      router.refresh();
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="broadcast">
            <Users className="size-4" />
            Бүх ажилтан
          </TabsTrigger>
          <TabsTrigger value="targeted">
            <UserPlus className="size-4" />
            Сонгосон ажилтнууд
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "targeted" && (
        <div className="flex flex-col gap-2">
          <Label>Хүлээн авагч</Label>
          <UserSearchPicker
            onSelect={addUser}
            excludeIds={selected.map((u) => u.id)}
            placeholder="Ажилтан хайх..."
            disabled={submitting}
          />
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selected.map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1">
                  {userLabel(u)}
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    className="ml-1"
                    aria-label="Хасах"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-title">Гарчиг</Label>
        <Input
          id="notif-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Мэдэгдлийн гарчиг"
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notif-message">Агуулга</Label>
        <Textarea
          id="notif-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Мэдэгдлийн дэлгэрэнгүй"
          disabled={submitting}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Төрөл</Label>
        <Select value={type} onValueChange={(v) => setType(v as NotificationType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="info">Мэдээлэл</SelectItem>
            <SelectItem value="success">Амжилт</SelectItem>
            <SelectItem value="warning">Анхааруулга</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={submitting}>
          <Send className="size-4" />
          Илгээх
        </Button>
      </div>
    </Card>
  );
}
