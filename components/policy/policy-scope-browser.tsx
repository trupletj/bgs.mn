"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";

import type {
  PolicyScopeBrowserGroup,
  PolicyScopeBrowserType,
} from "@/actions/policy-scope-browser";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PolicyScopeBrowser({
  groups,
  type,
}: {
  groups: PolicyScopeBrowserGroup[];
  type: PolicyScopeBrowserType;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const label = type === "alba" ? "Алба" : "Хэлтэс";

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groups, searchTerm]);

  const totalPolicies = groups.reduce(
    (sum, group) => sum + group.policies.length,
    0,
  );

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
          Журам / Жагсаалт
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          {label}-аар харах
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Нийт {groups.length} {label.toLowerCase()} · {totalPolicies} харьяалсан журам
        </p>
      </div>

      <Card className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={`${label}-ын нэрээр хайх...`}
            className="pl-9"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </Card>

      {filteredGroups.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-16 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">{label} олдсонгүй</p>
          <p className="text-sm text-muted-foreground">
            Хайлтын утгаа өөрчилж дахин оролдоно уу
          </p>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filteredGroups.map((group) => (
            <AccordionItem
              key={group.bteg_id}
              value={group.bteg_id}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {group.name}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {group.policies.length} журам
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t bg-muted/20 p-0">
                {group.policies.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-muted-foreground">
                    Журам байхгүй
                  </div>
                ) : (
                  <div className="divide-y">
                    {group.policies.map((policy) => (
                      <Link
                        key={policy.id}
                        href={`/policy/${policy.id}`}
                        className="flex min-w-0 items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {policy.name || "Нэргүй"}
                          </p>
                          {policy.reference_code && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {policy.reference_code}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatDate(policy.approved_date)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
