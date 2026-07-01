import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import { getDirections } from "@/actions/shift-exchange";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DirectionsPage() {
  const canView = await hasPermission("shift_exchange", "view");
  if (!canView) redirect("/unauthorized");

  const directions = await getDirections();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Ээлж солилцоо
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Чиглэлүүд
        </h1>
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Нэр</TableHead>
              <TableHead className="w-32">Замын цаг (ц)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {directions.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium text-foreground">
                  {d.name ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {d.zamTsag ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
