"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import type { PolicyScopeTarget } from "@/types/types";

interface ScopeHeltes {
  bteg_id: string;
  name: string | null;
  organization_id: string | null;
}

interface ScopeAlba {
  bteg_id: string;
  name: string | null;
  organization_id: string | null;
  heltes_id: string | null;
}

interface ScopeCompany {
  bteg_id: string;
  name: string | null;
}

interface PolicyScopeSelectorProps {
  value: PolicyScopeTarget[];
  onChange: Dispatch<PolicyScopeTarget[]>;
  disabled?: boolean;
}

const ALLOWED_COMPANY_IDS = ["1", "2", "20"];

function targetKey(target: PolicyScopeTarget) {
  return `${target.target_type}:${target.target_bteg_id}`;
}

function SelectionBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background",
      )}>
      {checked && <Check className="h-3 w-3" />}
    </span>
  );
}

export function PolicyScopeSelector({
  value,
  onChange,
  disabled,
}: PolicyScopeSelectorProps) {
  const [companies, setCompanies] = useState<ScopeCompany[]>([]);
  const [heltes, setHeltes] = useState<ScopeHeltes[]>([]);
  const [alba, setAlba] = useState<ScopeAlba[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase
        .from("organization")
        .select("bteg_id, name")
        .in("bteg_id", ALLOWED_COMPANY_IDS)
        .order("bteg_id"),
      supabase
        .from("heltes")
        .select("bteg_id, name, organization_id")
        .eq("is_active", true)
        .in("organization_id", ALLOWED_COMPANY_IDS)
        .order("name"),
      supabase
        .from("alba")
        .select("bteg_id, name, organization_id, heltes_id")
        .eq("is_active", true)
        .in("organization_id", ALLOWED_COMPANY_IDS)
        .order("name"),
    ]).then(([companyResult, heltesResult, albaResult]) => {
      if (!companyResult.error) setCompanies(companyResult.data ?? []);
      if (!heltesResult.error) setHeltes(heltesResult.data ?? []);
      if (!albaResult.error) setAlba(albaResult.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (selectedCompanyId || value.length === 0) return;

    const firstTarget = value[0];
    if (firstTarget.target_type === "heltes") {
      const selectedHeltes = heltes.find(
        (item) => item.bteg_id === firstTarget.target_bteg_id,
      );
      setSelectedCompanyId(selectedHeltes?.organization_id ?? "");
      return;
    }

    const selectedAlba = alba.find(
      (item) => item.bteg_id === firstTarget.target_bteg_id,
    );
    setSelectedCompanyId(selectedAlba?.organization_id ?? "");
  }, [alba, heltes, selectedCompanyId, value]);

  const selectedKeys = useMemo(() => new Set(value.map(targetKey)), [value]);
  const selectedCompany = companies.find(
    (company) => company.bteg_id === selectedCompanyId,
  );
  const companyHeltes = heltes.filter(
    (item) => item.organization_id === selectedCompanyId,
  );
  const companyAlba = alba.filter(
    (item) => item.organization_id === selectedCompanyId,
  );

  const toggleTarget = (target: PolicyScopeTarget) => {
    const key = targetKey(target);
    if (selectedKeys.has(key)) {
      onChange(value.filter((item) => targetKey(item) !== key));
      return;
    }

    onChange([...value, target]);
  };

  const removeTarget = (target: PolicyScopeTarget) => {
    const key = targetKey(target);
    onChange(value.filter((item) => targetKey(item) !== key));
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setOpen(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold">Хамаарах алба, хэлтэс</h2>
        <p className="text-sm text-muted-foreground">
          Энэ журам хамаарах олон хэлтэс болон албыг сонгоно.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                className="h-10 w-full justify-between">
                <span className="truncate">
                  {selectedCompany?.name ?? "Компани сонгох"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <Command>
                <CommandInput placeholder="Компани хайх..." />
                <CommandList>
                  <CommandEmpty>Company олдсонгүй</CommandEmpty>
                  <CommandGroup>
                    {companies.map((company) => (
                      <CommandItem
                        key={company.bteg_id}
                        value={`${company.bteg_id} ${company.name ?? ""}`}
                        onSelect={() => handleCompanySelect(company.bteg_id)}>
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedCompanyId === company.bteg_id
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {company.name ?? `Company ${company.bteg_id}`}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="rounded-md border">
          {!selectedCompanyId ? (
            <div className="p-4 text-sm text-muted-foreground">
              Эхлээд байгууллага сонгоно уу.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <div className="space-y-4 p-3">
                <div>
                  <p className="mb-2 text-sm font-medium">Хэлтэс</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {companyHeltes.map((item) => {
                      const target: PolicyScopeTarget = {
                        target_type: "heltes",
                        target_bteg_id: item.bteg_id,
                        target_name: item.name,
                      };
                      const isSelected = selectedKeys.has(targetKey(target));
                      return (
                        <div
                          key={item.bteg_id}
                          onClick={() => toggleTarget(target)}
                          role="button"
                          tabIndex={disabled ? -1 : 0}
                          aria-disabled={disabled}
                          onKeyDown={(event) => {
                            if (disabled) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleTarget(target);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                            disabled
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer",
                          )}>
                          <SelectionBox checked={isSelected} />
                          <span className="min-w-0 flex-1 truncate">
                            {item.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Алба</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {companyAlba.map((item) => {
                      const parent = companyHeltes.find(
                        (heltesItem) => heltesItem.bteg_id === item.heltes_id,
                      );
                      const target: PolicyScopeTarget = {
                        target_type: "alba",
                        target_bteg_id: item.bteg_id,
                        target_name: item.name,
                        parent_bteg_id: item.heltes_id,
                      };
                      const isSelected = selectedKeys.has(targetKey(target));
                      return (
                        <div
                          key={item.bteg_id}
                          onClick={() => toggleTarget(target)}
                          role="button"
                          tabIndex={disabled ? -1 : 0}
                          aria-disabled={disabled}
                          onKeyDown={(event) => {
                            if (disabled) return;
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleTarget(target);
                            }
                          }}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                            disabled
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer",
                          )}>
                          <span className="mt-0.5">
                            <SelectionBox checked={isSelected} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{item.name}</span>
                            {parent?.name && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {parent.name}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {value.map((target) => (
          <Badge
            key={targetKey(target)}
            variant="secondary"
            className="gap-1 pl-2 pr-1">
            {target.target_name ?? target.target_bteg_id}
            <span className="text-muted-foreground">
              {target.target_type === "heltes" ? "хэлтэс" : "алба"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="h-4 w-4"
              onClick={() => removeTarget(target)}>
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
