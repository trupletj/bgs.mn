import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { format } from "date-fns";
import OverrideForm from "@/components/dine/override-form";
import { DeleteOverrideButton } from "@/components/dine/delete-override-button";
import { DateFilter } from "@/components/dine/date-filter";
import { EditOverrideDialog } from "@/components/dine/edit-override-dialog";
import { hasPermission } from "@/actions/rbac";
import UnauthorizedPage from "@/app/unauthorized/page";

const MEAL_TYPES = [
  { id: "breakfast", label: "Ө.Цай" },
  { id: "morning_meal", label: "Ө.Хоол" },
  { id: "lunch", label: "Өдөр" },
  { id: "dinner", label: "Орой" },
  { id: "nightmeal", label: "Шөнө" },
];

export default async function TempKitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const is_create = await hasPermission("dining", "access");
  if (!is_create) {
    return <UnauthorizedPage />;
  }
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();
  const selectedDate =
    resolvedSearchParams.date || format(new Date(), "yyyy-MM-dd");
  const { data: halls } = await supabase.from("dining_hall").select("*");
  const { data: allOverrides } = await supabase
    .from("meal_location_overrides")
    .select(`*, dining_hall(name), users:user_id(nice_name)`)
    .eq("date", selectedDate);

  // Идэвхтэй болон Устгагдсан гэж салгах
  const activeOverrides = allOverrides?.filter((o) => !o.is_deleted) || [];
  const deletedOverrides = allOverrides?.filter((o) => o.is_deleted) || [];

  const summary = halls
    ?.map((hall) => {
      const counts = MEAL_TYPES.reduce((acc, meal) => {
        acc[meal.id] =
          activeOverrides?.filter(
            (o) => o.dining_hall_id === hall.id && o.meal_type === meal.id,
          ).length || 0;
        return acc;
      }, {} as any);

      const total = Object.values(counts).reduce(
        (a: any, b: any) => a + b,
        0,
      ) as number;
      return { name: hall.name, ...counts, total };
    })
    .filter((s) => s.total > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Түр шилжилт зохицуулалт</h1>
        <DateFilter initialDate={selectedDate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Түр хуваарилалт бүртгэх</CardTitle>
          </CardHeader>
          <CardContent>
            <OverrideForm diningHalls={halls || []} />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Нэгтгэсэн мэдээлэл</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Гал тогоо</TableHead>
                  {MEAL_TYPES.map((m) => (
                    <TableHead key={m.id} className="text-center text-xs">
                      {m.label}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-bold">Нийт</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary?.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    {MEAL_TYPES.map((m) => (
                      <TableCell key={m.id} className="text-center">
                        {s[m.id]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-bold">
                      {s.total}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Дэлгэрэнгүй жагсаалт</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ажилтан</TableHead>
                <TableHead>Хоол</TableHead>
                <TableHead>Очих гал тогоо</TableHead>
                <TableHead>Тэмдэглэл</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeOverrides?.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.users?.nice_name}</TableCell>
                  <TableCell className="text-xs">
                    {MEAL_TYPES.find((m) => m.id === o.meal_type)?.label ||
                      o.meal_type}
                  </TableCell>
                  <TableCell>{o.dining_hall?.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.note}
                  </TableCell>
                  <TableCell className="flex gap-2 justify-end">
                    <EditOverrideDialog
                      override={o}
                      diningHalls={halls || []}
                    />
                    <DeleteOverrideButton id={o.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Устгагдсан түүх */}
      {deletedOverrides.length > 0 && (
        <Card className="border-dashed bg-muted/20 opacity-80">
          <CardHeader className="">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              Устгагдсан түүх (Идэвхгүй)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-xs">Ажилтан</TableHead>
                  <TableHead className="h-8 text-xs">Хоол</TableHead>
                  <TableHead className="h-8 text-xs">
                    Байсан гал тогоо
                  </TableHead>
                  <TableHead className="h-8 text-xs">Тэмдэглэл</TableHead>
                  <TableHead className="h-8 text-right text-xs text-destructive">
                    Устгагдсан
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedOverrides.map((o) => (
                  <TableRow
                    key={o.id}
                    className="hover:bg-transparent border-none">
                    <TableCell className=" text-sm text-muted-foreground line-through">
                      {o.users?.nice_name}
                    </TableCell>
                    <TableCell className=" text-xs italic">
                      {MEAL_TYPES.find((m) => m.id === o.meal_type)?.label}
                    </TableCell>
                    <TableCell className=" text-sm">
                      {o.dining_hall?.name}
                    </TableCell>
                    <TableCell className=" text-xs text-muted-foreground max-w-[200px] truncate">
                      {o.note}
                    </TableCell>
                    <TableCell className=" text-right text-xs font-mono">
                      {format(new Date(o.created_at), "HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
