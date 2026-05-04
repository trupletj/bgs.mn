"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEVICE_TYPE_CONFIG, type OrgStructure } from "@/types/device";
import { REQUEST_TYPE_CONFIG, PRIORITY_CONFIG } from "@/components/devices/request-shared";
import { DeviceRequestsCardList } from "@/components/devices/device-requests-card-list";
import type { DeviceRequestType, DeviceRequestPriority, DeviceRequestStatus } from "@/actions/devices";
import { Search, X } from "lucide-react";

const ALL = "__all__";

const STATUS_CONFIG: Record<DeviceRequestStatus, { label: string }> = {
  pending:  { label: "Хүлээгдэж буй" },
  approved: { label: "Зөвшөөрөгдсөн" },
  rejected: { label: "Татгалзсан" },
};

type Request = any;

interface Props {
  data: Request[];
  orgStructure: OrgStructure;
}

const PILL = "rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer";
const PILL_ON = "bg-foreground text-background border-foreground";
const PILL_OFF = "bg-transparent text-muted-foreground hover:text-foreground border-border";

export function DeviceRequestsTable({ data, orgStructure }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter]     = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter]         = useState<Set<string>>(new Set());
  const [reqTypeFilter, setReqTypeFilter]   = useState<Set<string>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());

  const makeToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleStatus   = makeToggle(setStatusFilter);
  const toggleType     = makeToggle(setTypeFilter);
  const toggleReqType  = makeToggle(setReqTypeFilter);
  const togglePriority = makeToggle(setPriorityFilter);
  const [orgFilter, setOrgFilter] = useState("");
  const [heltesFilter, setHeltesFilter] = useState("");
  const [albaFilter, setAlbaFilter] = useState("");

  // Name lookup maps by bteg_id
  const orgByBteg = useMemo(
    () => Object.fromEntries(orgStructure.organizations.map(o => [o.bteg_id, o.name])),
    [orgStructure.organizations]
  );
  const heltesByBteg = useMemo(
    () => Object.fromEntries(orgStructure.heltes.map(h => [h.bteg_id, h.name])),
    [orgStructure.heltes]
  );
  const albaByBteg = useMemo(
    () => Object.fromEntries(orgStructure.alba.map(a => [a.bteg_id, a.name])),
    [orgStructure.alba]
  );

  // Filter cascade selects
  const selectedFilterOrg = orgStructure.organizations.find(o => o.id === orgFilter);
  const filterHeltesOptions = useMemo(
    () => selectedFilterOrg
      ? orgStructure.heltes.filter(h => h.org_bteg_id === selectedFilterOrg.bteg_id)
      : orgStructure.heltes,
    [selectedFilterOrg, orgStructure.heltes]
  );
  const selectedFilterHeltes = orgStructure.heltes.find(h => h.id === heltesFilter);
  const filterAlbaOptions = useMemo(
    () => selectedFilterHeltes
      ? orgStructure.alba.filter(a => a.heltes_bteg_id === selectedFilterHeltes.bteg_id)
      : selectedFilterOrg
      ? orgStructure.alba.filter(a => a.org_bteg_id === selectedFilterOrg.bteg_id)
      : orgStructure.alba,
    [selectedFilterHeltes, selectedFilterOrg, orgStructure.alba]
  );

  // Client-side filtering
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false;
      if (typeFilter.size > 0 && !typeFilter.has(r.device_type)) return false;
      if (reqTypeFilter.size > 0 && !reqTypeFilter.has(r.request_type)) return false;
      if (priorityFilter.size > 0 && !priorityFilter.has(r.priority ?? "normal")) return false;
      if (orgFilter) {
        const org = orgStructure.organizations.find(o => o.id === orgFilter);
        if (org && r.req_org_bteg !== org.bteg_id) return false;
      }
      if (heltesFilter) {
        const h = orgStructure.heltes.find(h => h.id === heltesFilter);
        if (h && r.req_heltes_bteg !== h.bteg_id) return false;
      }
      if (albaFilter) {
        const a = orgStructure.alba.find(a => a.id === albaFilter);
        if (a && r.req_alba_bteg !== a.bteg_id) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return (
          r.creator?.name?.toLowerCase().includes(q) ||
          r.purpose?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [data, statusFilter, typeFilter, reqTypeFilter, priorityFilter, orgFilter, heltesFilter, albaFilter, search, orgStructure]);

  // Card list-руу өгөх structure: parent + children + orphans
  const cardGroups = useMemo(() => {
    const filteredIds = new Set(filtered.map((r) => r.id));
    const parents: any[] = [];
    const childrenByParent = new Map<string, any[]>();
    const orphans: any[] = [];

    for (const r of filtered) {
      if (r.parent_request_id) {
        if (filteredIds.has(r.parent_request_id)) {
          const arr = childrenByParent.get(r.parent_request_id) ?? [];
          arr.push(r);
          childrenByParent.set(r.parent_request_id, arr);
        } else {
          orphans.push(r);
        }
      } else {
        parents.push(r);
      }
    }

    parents.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    for (const arr of childrenByParent.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    }

    const groups = parents.map((p) => ({
      parent: p,
      children: childrenByParent.get(p.id) ?? [],
    }));

    return { groups, orphans };
  }, [filtered]);


  // Бүх хүсэлтийн parent lookup — orphan child-руу parent summary үзүүлэхэд хэрэгтэй
  const parentLookup = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of data) {
      if (!r.parent_request_id) map.set(r.id, r);
    }
    return map;
  }, [data]);

  const lookups = useMemo(
    () => ({ orgByBteg, heltesByBteg, albaByBteg, parentLookup }),
    [orgByBteg, heltesByBteg, albaByBteg, parentLookup],
  );

  const hasActiveFilters =
    statusFilter.size > 0 || typeFilter.size > 0 || reqTypeFilter.size > 0 || priorityFilter.size > 0 ||
    !!orgFilter || !!heltesFilter || !!albaFilter || !!search;

  function clearFilters() {
    setSearch("");
    setStatusFilter(new Set()); setTypeFilter(new Set());
    setReqTypeFilter(new Set()); setPriorityFilter(new Set());
    setOrgFilter(""); setHeltesFilter(""); setAlbaFilter("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filter bar ─── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Нэр, зориулалт хайх..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Цэвэрлэх
            </Button>
          )}
        </div>

        {/* Status — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatusFilter(new Set())} className={cn(PILL, statusFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүгд
          </button>
          {(Object.entries(STATUS_CONFIG) as [string, { label: string }][]).map(([k, v]) => (
            <button key={k} onClick={() => toggleStatus(k)} className={cn(PILL, statusFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {v.label}
            </button>
          ))}
        </div>

        {/* Device type — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTypeFilter(new Set())} className={cn(PILL, typeFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүх төхөөрөмж
          </button>
          {Object.entries(DEVICE_TYPE_CONFIG).map(([k, cfg]) => (
            <button key={k} onClick={() => toggleType(k)} className={cn(PILL, typeFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Request type — multi-select */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setReqTypeFilter(new Set())} className={cn(PILL, reqTypeFilter.size === 0 ? PILL_ON : PILL_OFF)}>
            Бүх хүсэлт
          </button>
          {(Object.entries(REQUEST_TYPE_CONFIG) as [DeviceRequestType, typeof REQUEST_TYPE_CONFIG[DeviceRequestType]][]).map(([k, cfg]) => (
            <button key={k} onClick={() => toggleReqType(k)} className={cn(PILL, reqTypeFilter.has(k) ? PILL_ON : PILL_OFF)}>
              {cfg.emoji} {cfg.label}
            </button>
          ))}
        </div>

        {/* Priority + org cascade */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <button onClick={() => setPriorityFilter(new Set())} className={cn(PILL, priorityFilter.size === 0 ? PILL_ON : PILL_OFF)}>
              Бүх зэрэглэл
            </button>
            {(Object.entries(PRIORITY_CONFIG) as [DeviceRequestPriority, typeof PRIORITY_CONFIG[DeviceRequestPriority]][]).map(([k, cfg]) => (
              <button key={k} onClick={() => togglePriority(k)} className={cn(PILL, priorityFilter.has(k) ? PILL_ON : PILL_OFF)}>
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 ml-auto">
            <Select
              value={orgFilter || ALL}
              onValueChange={v => { setOrgFilter(v === ALL ? "" : v); setHeltesFilter(""); setAlbaFilter(""); }}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Байгууллага" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {orgStructure.organizations.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={heltesFilter || ALL}
              disabled={!orgFilter}
              onValueChange={v => { setHeltesFilter(v === ALL ? "" : v); setAlbaFilter(""); }}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Хэлтэс" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {filterHeltesOptions.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={albaFilter || ALL}
              disabled={!heltesFilter}
              onValueChange={v => setAlbaFilter(v === ALL ? "" : v)}
            >
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Алба" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Бүгд</SelectItem>
                {filterAlbaOptions.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {filtered.length} хүсэлт
          {cardGroups.groups.length > 0 && (
            <span className="ml-1 text-muted-foreground/70">
              · {cardGroups.groups.length} групп
            </span>
          )}
          {cardGroups.orphans.length > 0 && (
            <span className="ml-1 text-amber-700">
              · {cardGroups.orphans.length} хосгүй
            </span>
          )}
        </p>
      </div>

      <DeviceRequestsCardList
        groups={cardGroups.groups}
        orphanChildren={cardGroups.orphans}
        lookups={lookups}
        pageSize={10}
      />
    </div>
  );
}
