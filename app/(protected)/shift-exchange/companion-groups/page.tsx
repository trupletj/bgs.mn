import { redirect } from "next/navigation";
import { hasPermission } from "@/actions/rbac";
import { getCompanionGroups } from "@/actions/shift-exchange";
import { CompanionGroupsManager } from "@/components/shift-exchange/companion-groups-manager";

export default async function CompanionGroupsPage() {
  if (!(await hasPermission("shift_exchange", "view"))) redirect("/unauthorized");

  const groups = await getCompanionGroups();

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Ээлж солилцоо
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Хамтрагч бүлгүүд
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Хамт явахыг хүссэн хүмүүсийг нэг бүлэгт нэгтгэнэ. Ухаалаг хуваарилалт
          тэдгээрийг (ижил чиглэлд) нэг автобусанд хадгална. Бүлэг тогтмол —
          ээлж бүрт дахин үүсгэх шаардлагагүй.
        </p>
      </div>

      <CompanionGroupsManager groups={groups} />
    </div>
  );
}
