import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar, Info } from "lucide-react";
import { hasPermission, hasRole } from "@/actions/rbac";
import {
  getLinkedGroups,
  getMyExchangeSubmissions,
  getMyOrgEeljGroups,
  getOrganizations,
  getShiftExchange,
} from "@/actions/shift-exchange";
import {
  DirectionBadge,
  DIRECTION_LABEL,
  StatusBadge,
  registrationDeadline,
  repRegistrationOpen,
  formatBusDateTime,
} from "@/components/shift-exchange/shared";
import { SubmitPoolPanel } from "@/components/shift-exchange/submit-pool-panel";

export default async function RegisterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);

  const [canSubmit, canView, isSuperAdmin] = await Promise.all([
    hasPermission("shift_exchange", "submit"),
    hasPermission("shift_exchange", "view"),
    hasRole("super_admin"),
  ]);
  if (!canSubmit && !canView) redirect("/unauthorized");

  const exchange = await getShiftExchange(id);
  if (!exchange) notFound();

  const [mySubmissions, organizations, myOrgEeljGroups, linkedGroups] =
    await Promise.all([
      getMyExchangeSubmissions(id),
      isSuperAdmin ? getOrganizations() : Promise.resolve([]),
      isSuperAdmin ? Promise.resolve([]) : getMyOrgEeljGroups(),
      getLinkedGroups(id),
    ]);
  const linkedGroupIds = new Set(linkedGroups.map((g) => g.btegId));

  const deadline = registrationDeadline(exchange.exchangeDate);
  const overrideUntil = exchange.registrationOverrideUntil;
  // Бүртгэлийн хуудсанд хугацаа бүгдэд үйлчилнэ. HR хугацаа дууссан бол ээлжийн
  // дэлгэцээс шууд нэмэх эсвэл "хугацаа сунгах"-аар нээнэ.
  const canRegister = repRegistrationOpen(exchange);

  return (
    <div className="flex w-full flex-col gap-6 p-4 lg:p-6">
      <div>
        <Link
          href="/shift-exchange/register"
          className="text-xs text-muted-foreground hover:underline">
          ← Ээлжүүд
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {exchange.name}
          </h1>
          <StatusBadge status={exchange.status} />
          <DirectionBadge direction={exchange.direction} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="tabular-nums">{exchange.exchangeDate}</span>
          </span>
          <span className="text-xs">
            Бүртгэлийн эцсийн хугацаа:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {deadline}
            </span>
            {overrideUntil && (
              <span className="ml-1 text-amber-600">
                (Хүний нөөцийн ажилтан сунгасан:{" "}
                {formatBusDateTime(overrideUntil)}
                )
              </span>
            )}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium text-foreground">
              «{exchange.name}»
            </span>{" "}
            ээлжийн{" "}
            <span className="font-medium text-foreground">
              {DIRECTION_LABEL[exchange.direction].toLowerCase()}
            </span>{" "}
            зорчигчдыг{" "}
            {isSuperAdmin
              ? "дурын байгууллагаас"
              : "зөвхөн өөрийн байгууллагынхныг"}{" "}
            бүртгэнэ. Бүртгэсэн хүмүүсийг хүний нөөцийн ажилтан автобусанд
            хуваарилна.
          </p>
        </div>
      </div>

      <SubmitPoolPanel
        exchangeId={id}
        myPool={mySubmissions}
        canRegister={canRegister}
        isSuperAdmin={isSuperAdmin}
        organizations={organizations}
        myOrgEeljGroups={myOrgEeljGroups}
        linkedGroupIds={linkedGroupIds}
      />
    </div>
  );
}
