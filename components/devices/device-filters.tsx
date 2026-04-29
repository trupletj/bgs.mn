"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DEVICE_TYPE_CONFIG, DEVICE_STATUS_CONFIG, type OrgStructure } from "@/types/device";

const NONE = "__none__";

interface DeviceFiltersProps {
  orgStructure: OrgStructure;
}

export function DeviceFilters({ orgStructure }: DeviceFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = {
    search:    searchParams.get("search") ?? "",
    org_id:    searchParams.get("org_id") ?? "",
    heltes_id: searchParams.get("heltes_id") ?? "",
    alba_id:   searchParams.get("alba_id") ?? "",
    type:      searchParams.get("type") ?? "",
    status:    searchParams.get("status") ?? "",
  };

  const hasFilters = Object.values(current).some(Boolean);

  const selectedOrg = orgStructure.organizations.find(o => o.id === current.org_id);
  const filteredHeltes = useMemo(
    () => selectedOrg
      ? orgStructure.heltes.filter(h => h.org_bteg_id === selectedOrg.bteg_id)
      : orgStructure.heltes,
    [selectedOrg, orgStructure.heltes]
  );

  const selectedHeltes = orgStructure.heltes.find(h => h.id === current.heltes_id);
  const filteredAlba = useMemo(() => {
    if (selectedHeltes) return orgStructure.alba.filter(a => a.heltes_bteg_id === selectedHeltes.bteg_id);
    if (selectedOrg)    return orgStructure.alba.filter(a => a.org_bteg_id === selectedOrg.bteg_id);
    return orgStructure.alba;
  }, [selectedHeltes, selectedOrg, orgStructure.alba]);

  const update = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  }, [router, pathname, searchParams]);

  const handleOrgChange = (v: string) => {
    const val = v === NONE ? "" : v;
    update({ org_id: val, heltes_id: "", alba_id: "" });
  };
  const handleHeltesChange = (v: string) => {
    const val = v === NONE ? "" : v;
    update({ heltes_id: val, alba_id: "" });
  };

  const clear = useCallback(() => {
    startTransition(() => router.replace(pathname));
  }, [router, pathname]);

  return (
    <div className="flex flex-col gap-3">
      {/* Хайлт + Төрөл + Статус */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Нэр, загвар, серийн дугаар..."
            defaultValue={current.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Select value={current.type || NONE} onValueChange={(v) => update({ type: v === NONE ? "" : v })}>
          <SelectTrigger className="h-8 text-sm w-[150px]">
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Бүх төрөл</SelectItem>
            {Object.entries(DEVICE_TYPE_CONFIG).map(([t, cfg]) => (
              <SelectItem key={t} value={t}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={current.status || NONE} onValueChange={(v) => update({ status: v === NONE ? "" : v })}>
          <SelectTrigger className="h-8 text-sm w-[140px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Бүх статус</SelectItem>
            {Object.entries(DEVICE_STATUS_CONFIG).map(([s, cfg]) => (
              <SelectItem key={s} value={s}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={clear}>
            <X className="h-3.5 w-3.5" />
            Цэвэрлэх
          </Button>
        )}
      </div>

      {/* Байгууллага → Хэлтэс → Алба */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Байгууллага */}
        <Select value={current.org_id || NONE} onValueChange={handleOrgChange}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-[220px]">
            <SelectValue placeholder="Байгууллага" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Бүх байгуулга</SelectItem>
            {orgStructure.organizations.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Хэлтэс */}
        <Select value={current.heltes_id || NONE} onValueChange={handleHeltesChange}
          disabled={filteredHeltes.length === 0}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-[200px]">
            <SelectValue placeholder="Хэлтэс" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Бүх хэлтэс</SelectItem>
            {filteredHeltes.map(h => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Алба */}
        <Select value={current.alba_id || NONE}
          onValueChange={(v) => update({ alba_id: v === NONE ? "" : v })}
          disabled={filteredAlba.length === 0}>
          <SelectTrigger className="h-8 text-sm w-full sm:w-[200px]">
            <SelectValue placeholder="Алба" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Бүх алба</SelectItem>
            {filteredAlba.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
