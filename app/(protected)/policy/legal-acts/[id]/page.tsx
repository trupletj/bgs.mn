import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Paperclip, Trash2 } from "lucide-react";
import { hasPermission } from "@/actions/rbac";
import {
  deleteLegalAct,
  formatLegalActDate,
  getLegalActDetail,
  getLegalActTypeLabel,
} from "@/actions/policy-legal-acts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface LegalActDetailPageProps {
  params: Promise<{ id: string }>;
}

export const revalidate = 0;

export default async function LegalActDetailPage({ params }: LegalActDetailPageProps) {
  const { id } = await params;
  const [act, canDelete] = await Promise.all([
    getLegalActDetail(id),
    hasPermission("policy", "delete"),
  ]);

  if (!act) {
    return (
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        <Button asChild variant="outline" size="sm" className="self-start">
          <Link href="/policy/legal-acts">
            <ArrowLeft className="h-4 w-4" />
            Буцах
          </Link>
        </Button>
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">Эрх зүйн акт олдсонгүй</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon-sm">
          <Link href="/policy/legal-acts">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Буцах</span>
          </Link>
        </Button>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Журам / Эрх зүйн акт
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={act.act_type === "04" ? "default" : "secondary"}>
              {getLegalActTypeLabel(act.act_type)}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {act.act_number}
            </Badge>
            <span className="text-sm tabular-nums text-muted-foreground">
              {formatLegalActDate(act.act_date)}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {act.title}
          </h1>
        </div>

        {canDelete && (
          <form action={deleteLegalAct}>
            <input type="hidden" name="id" value={act.id} />
            <Button type="submit" variant="destructive">
              <Trash2 className="h-4 w-4" />
              Устгах
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-5">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-foreground">Тушаалын текст</h2>
            <Separator className="my-3" />
            {act.body_text ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {act.body_text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Гараар оруулсан текст байхгүй</p>
            )}
            {act.notes && (
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {act.notes}
              </p>
            )}
          </Card>

          {act.revisions.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-foreground">Журмын шинэчлэл</h2>
              <Separator className="my-3" />
              <div className="space-y-4">
                {act.revisions.map((revision) => (
                  <div key={revision.id} className="space-y-3">
                    <div>
                      <Link
                        href={`/policy/${revision.policy_id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {revision.policy?.reference_code
                          ? `${revision.policy.reference_code} · `
                          : ""}
                        {revision.policy?.name || "Журам"}
                      </Link>
                      {revision.summary && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {revision.summary}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {revision.targets.map((target) => (
                        <div key={target.id} className="rounded-md border px-3 py-2">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="shrink-0">
                              {target.target_type === "policy"
                                ? "Журам"
                                : target.target_type === "section"
                                  ? "Бүлэг"
                                  : "Заалт"}
                            </Badge>
                            <div className="min-w-0">
                              <p className="text-sm text-foreground">
                                {target.target_type === "policy" && "Журмын нэр / ерөнхий мэдээлэл"}
                                {target.target_type === "section" &&
                                  `${target.section?.reference_number ?? ""}. ${target.section?.text ?? ""}`}
                                {target.target_type === "clause" &&
                                  `${target.clause?.reference_number ?? ""}. ${target.clause?.text ?? ""}`}
                              </p>
                              {target.change_note && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {target.change_note}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit p-4">
          <h2 className="text-sm font-semibold text-foreground">Хавсралт</h2>
          <Separator className="my-3" />
          {act.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Файл хавсаргаагүй</p>
          ) : (
            <div className="space-y-2">
              {act.attachments.map((attachment) => (
                <Button
                  key={attachment.id}
                  asChild
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-2"
                >
                  <Link
                    href={`/api/policy/legal-acts/${act.id}/attachments/${attachment.id}`}
                    target="_blank"
                  >
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-left">{attachment.file_name}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
