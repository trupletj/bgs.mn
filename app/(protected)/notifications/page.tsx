import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";
import { getSentNotifications } from "@/actions/notifications";
import { NotificationComposer } from "@/components/notifications/notification-composer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const typeLabel: Record<string, string> = {
  info: "Мэдээлэл",
  success: "Амжилт",
  warning: "Анхааруулга",
};

const typeClass: Record<string, string> = {
  info: "border-transparent bg-indigo-100 text-indigo-700",
  success: "border-transparent bg-emerald-100 text-emerald-700",
  warning: "border-transparent bg-amber-100 text-amber-700",
};

interface SentGroup {
  key: string;
  title: string;
  type: string;
  recipients: number;
  sentAt: string;
}

export default async function NotificationsAdminPage() {
  const canCreate = await hasPermission("notification", "create");
  if (!canCreate) return <UnauthorizedPage />;

  const rows = await getSentNotifications(300);

  // Broadcast нэг мэдэгдэл = олон мөр. Гарчиг+агуулга+минутаар бүлэглэж тоолно.
  const groups = new Map<string, SentGroup>();
  for (const r of rows) {
    const key = `${r.title}|${r.message}|${r.type}|${r.createdAt.slice(0, 16)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.recipients += 1;
    } else {
      groups.set(key, {
        key,
        title: r.title,
        type: r.type,
        recipients: 1,
        sentAt: r.createdAt,
      });
    }
  }
  const sent = Array.from(groups.values()).sort((a, b) =>
    b.sentAt.localeCompare(a.sentAt),
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Контент
        </p>
        <h1 className="text-2xl font-bold">Мэдэгдэл</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ажилтнуудад мэдэгдэл илгээх. Mobile апп хэрэглэгч бүрийн мэдэгдлийг
          харуулна.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">Шинэ мэдэгдэл</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <NotificationComposer />

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">Сүүлд илгээсэн</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Гарчиг</TableHead>
              <TableHead className="w-28">Төрөл</TableHead>
              <TableHead className="w-28">Хүлээн авагч</TableHead>
              <TableHead className="w-40">Илгээсэн</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sent.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Илгээсэн мэдэгдэл алга.
                </TableCell>
              </TableRow>
            ) : (
              sent.map((g) => (
                <TableRow key={g.key}>
                  <TableCell className="font-medium">{g.title}</TableCell>
                  <TableCell>
                    <Badge className={typeClass[g.type] ?? typeClass.info}>
                      {typeLabel[g.type] ?? g.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.recipients}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {g.sentAt.slice(0, 16).replace("T", " ")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
