import Link from "next/link";
import { FileText, Paperclip, Plus, Search } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import {
  formatLegalActDate,
  getLegalActs,
  getLegalActTypeLabel,
  type LegalActType,
} from "@/actions/policy-legal-acts";
import UnauthorizedPage from "@/app/unauthorized/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LegalActsPageProps {
  searchParams: Promise<{ type?: string }>;
}

export const revalidate = 0;

export default async function LegalActsPage({ searchParams }: LegalActsPageProps) {
  const [{ type }, canAccess, canCreate] = await Promise.all([
    searchParams,
    hasPermission("policy", "access"),
    hasPermission("policy", "create"),
  ]);

  if (!canAccess) return <UnauthorizedPage />;

  const activeType =
    type === "03" || type === "04" ? (type as LegalActType) : "all";
  const legalActs = await getLegalActs(activeType);

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
            Журам / Эрх зүйн акт
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Эрх зүйн акт
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Даргын 03, 04 тушаалын бүртгэл
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/policy/legal-acts/new">
              <Plus className="h-4 w-4" />
              Эрх зүйн акт нэмэх
            </Link>
          </Button>
        )}
      </div>

      <Card className="flex flex-wrap gap-2 p-3">
        <Button asChild variant={activeType === "all" ? "default" : "outline"} size="sm">
          <Link href="/policy/legal-acts">Бүгд</Link>
        </Button>
        <Button asChild variant={activeType === "04" ? "default" : "outline"} size="sm">
          <Link href="/policy/legal-acts?type=04">04 - Журам шинэчлэх</Link>
        </Button>
        <Button asChild variant={activeType === "03" ? "default" : "outline"} size="sm">
          <Link href="/policy/legal-acts?type=03">03 - Сахилгын шийтгэл</Link>
        </Button>
      </Card>

      {legalActs.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <Search className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Эрх зүйн акт олдсонгүй</p>
          <p className="text-sm text-muted-foreground">
            Эхний тушаалыг бүртгэснээр энд харагдана
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Тушаал</TableHead>
                <TableHead className="w-36">Огноо</TableHead>
                <TableHead>Холбоотой журам</TableHead>
                <TableHead className="w-28 text-right">Хавсралт</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legalActs.map((act) => (
                <TableRow key={act.id}>
                  <TableCell>
                    <Link
                      href={`/policy/legal-acts/${act.id}`}
                      className="flex min-w-0 flex-col gap-1 hover:text-primary"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={act.act_type === "04" ? "default" : "secondary"}>
                          {act.act_type}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {act.act_number}
                        </span>
                      </div>
                      <span className="font-semibold text-foreground">{act.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {getLegalActTypeLabel(act.act_type)}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatLegalActDate(act.act_date)}
                  </TableCell>
                  <TableCell>
                    {act.policies.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {act.policies.slice(0, 2).map((policy) => (
                          <span key={policy.id} className="text-sm">
                            {policy.reference_code ? `${policy.reference_code} · ` : ""}
                            {policy.name}
                          </span>
                        ))}
                        {act.policies.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{act.policies.length - 2} журам
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      {act.attachment_count > 0 ? (
                        <Paperclip className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {act.attachment_count}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
