"use client";

import * as React from "react";
import { CheckCircle2, Network, User, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { updateClauseJobPosition } from "@/actions/clause-position";
import { cn } from "@/lib/utils";
import {
  ClauseJobPosition,
  OrganizationWithJobRelations,
} from "@/types/types";
import OrganizationNode from "./OrganizationNode";
import { JobDescriptionSheet } from "../job-description/job-description-sheet";

type ActionType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

const ACTION_LABEL: Record<ActionType, string> = {
  IMPLEMENTATION: "Хэрэгжүүлэлт",
  MONITORING: "Хяналт",
  VERIFICATION: "Баталгаажуулалт",
  DEPLOYMENT: "Нэвтрүүлэлт",
};

const ACTION_COLOR: Record<ActionType, string> = {
  IMPLEMENTATION: "bg-emerald-100 text-emerald-700",
  MONITORING: "bg-amber-100 text-amber-700",
  VERIFICATION: "bg-cyan-100 text-cyan-700",
  DEPLOYMENT: "bg-violet-100 text-violet-700",
};

export interface PositionInfo {
  id: string;
  name: string;
  scope: string; // org / heltes / alba хэлбэрээр буюу breadcrumb
}

type PositionMap = Map<string, ClauseJobPosition>;
type PositionMapAction =
  | { type: "set"; jobPositionId: string; row: ClauseJobPosition }
  | { type: "remove"; jobPositionId: string };

const PositionMapContext = React.createContext<{
  map: PositionMap;
  dispatch: React.Dispatch<PositionMapAction>;
} | null>(null);

export function usePositionMap() {
  const ctx = React.useContext(PositionMapContext);
  if (!ctx) throw new Error("PositionMapContext missing");
  return ctx;
}

function reducer(state: PositionMap, action: PositionMapAction): PositionMap {
  const next = new Map(state);
  if (action.type === "set") {
    next.set(action.jobPositionId, action.row);
  } else if (action.type === "remove") {
    next.delete(action.jobPositionId);
  }
  return next;
}

interface Props {
  organizations: OrganizationWithJobRelations[];
  initialPositions: ClauseJobPosition[];
  positionInfoById: Record<string, PositionInfo>;
}

export function ClauseConnectClient({
  organizations,
  initialPositions,
  positionInfoById,
}: Props) {
  const [map, dispatch] = React.useReducer(
    reducer,
    new Map(initialPositions.map((p) => [p.job_position_id, p])),
  );
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedPositionId, setSelectedPositionId] = React.useState("");

  const handleSelectPosition = (posId: string) => {
    setSelectedPositionId(posId);
    setSheetOpen(true);
  };

  const checkedRows = React.useMemo(
    () => Array.from(map.values()).filter((r) => r.is_checked),
    [map],
  );

  const handleRemoveLink = async (row: ClauseJobPosition) => {
    const updated = await updateClauseJobPosition({
      id: row.id,
      is_checked: false,
    });
    dispatch({
      type: "set",
      jobPositionId: row.job_position_id,
      row: updated,
    });
    toast.info("Холболтоос салгалаа");
  };

  return (
    <PositionMapContext.Provider value={{ map, dispatch }}>
      <TooltipProvider delayDuration={150}>
        {/* Linked positions summary */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Холбогдсон ажлын байрууд
            </h2>
            <Badge variant="secondary" className="tabular-nums">
              {checkedRows.length}
            </Badge>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Card className="p-3">
            {checkedRows.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                Хараахан ажлын байр холбогдоогүй байна
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {checkedRows.map((row) => {
                  const info = positionInfoById[row.job_position_id];
                  const type = (row.type ?? "IMPLEMENTATION") as ActionType;
                  return (
                    <div
                      key={row.id}
                      className="group flex items-center gap-1.5 rounded-full border border-border bg-card pl-2 pr-1 py-0.5 text-xs"
                    >
                      <User className="h-3 w-3 text-muted-foreground" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectPosition(row.job_position_id)
                            }
                            className="font-medium text-foreground hover:underline"
                          >
                            {info?.name ?? "Тодорхойгүй ажлын байр"}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {info?.scope ?? "Албан тушаалын тодорхойлолт"}
                        </TooltipContent>
                      </Tooltip>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          ACTION_COLOR[type],
                        )}
                      >
                        {ACTION_LABEL[type]}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleRemoveLink(row)}
                            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                            <span className="sr-only">Холболтоос салгах</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Холболтоос салгах</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </section>

        {/* Org tree */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Байгууллагын бүтэц
            </h2>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {organizations.length > 0 ? (
              organizations.map((org) => (
                <OrganizationNode
                  key={org.id}
                  organization={org}
                  onSelectPosition={handleSelectPosition}
                />
              ))
            ) : (
              <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                Байгууллагын мэдээлэл байхгүй байна
              </p>
            )}
          </div>
        </section>
      </TooltipProvider>

      <JobDescriptionSheet
        isOpen={sheetOpen}
        onOpenChange={setSheetOpen}
        positionId={selectedPositionId}
      />
    </PositionMapContext.Provider>
  );
}
