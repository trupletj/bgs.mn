"use client";

import * as React from "react";
import { Briefcase, Building2, ChevronRight, User, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createClauseJobPosition,
  updateClauseJobPosition,
} from "@/actions/clause-position";
import { cn } from "@/lib/utils";
import {
  AlbaWithJobRelations,
  HeltesWithJobRelations,
  JobPosition,
  OrganizationWithJobRelations,
} from "@/types/types";
import { usePositionMap } from "./ClauseConnectClient";

type ActionType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
  { value: "MONITORING", label: "Хяналт" },
  { value: "VERIFICATION", label: "Баталгаажуулалт" },
  { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
];

type Params = { clause_id: string };

interface OrganizationNodeProps {
  organization: OrganizationWithJobRelations;
  onSelectPosition: (posId: string) => void;
}

export default function OrganizationNode({
  organization,
  onSelectPosition,
}: OrganizationNodeProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-2 px-2 font-semibold"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <Building2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm">{organization.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pl-4 pt-1">
        {organization.job_position && organization.job_position.length > 0 && (
          <div className="space-y-0.5">
            {organization.job_position.map((position) => (
              <PositionNode
                key={position.id}
                position={position}
                onSelectPosition={onSelectPosition}
              />
            ))}
          </div>
        )}

        {organization.heltes.map((helts) => (
          <DepartmentNode
            key={helts.id}
            department={helts}
            onSelectPosition={onSelectPosition}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PositionNode({
  position,
  onSelectPosition,
}: {
  position: JobPosition;
  onSelectPosition: (posId: string) => void;
}) {
  const { map, dispatch } = usePositionMap();
  const { clause_id } = useParams<Params>();
  const data = map.get(position.id) ?? null;

  const handleCheckChange = async (checked: boolean | "indeterminate") => {
    if (!clause_id || !position?.id) return;
    const newCheckedState = checked === true;

    if (data) {
      const updated = await updateClauseJobPosition({
        id: data.id,
        is_checked: newCheckedState,
      });
      dispatch({ type: "set", jobPositionId: position.id, row: updated });
      if (newCheckedState) {
        const label =
          ACTION_TYPES.find((t) => t.value === updated.type)?.label ??
          updated.type;
        toast.success(`${label} төрөлтэй холбогдлоо`);
      } else {
        toast.info("Холболтоос салгалаа");
      }
    } else {
      const created = await createClauseJobPosition({
        clauseId: clause_id,
        jobPositionId: position.id,
        is_checked: true,
        type: "IMPLEMENTATION",
      });
      dispatch({ type: "set", jobPositionId: position.id, row: created });
      toast.success("Хэрэгжүүлэлт төрөлтэй холбогдлоо");
    }
  };

  const handleTypeChange = async (value: ActionType) => {
    if (!data) return;
    const updated = await updateClauseJobPosition({
      id: data.id,
      type: value,
    });
    dispatch({ type: "set", jobPositionId: position.id, row: updated });
    const label = ACTION_TYPES.find((t) => t.value === value)?.label ?? value;
    toast.success(`${label} төрөлтэй болсон`);
  };

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40">
      <Checkbox
        checked={data?.is_checked || false}
        onCheckedChange={handleCheckChange}
      />
      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectPosition(position.id)}
            className="flex-1 truncate text-left text-sm text-foreground hover:underline"
          >
            {position.name}
          </button>
        </TooltipTrigger>
        <TooltipContent>Албан тушаалын тодорхойлолт</TooltipContent>
      </Tooltip>
      {data?.is_checked && (
        <Select
          onValueChange={(val) => handleTypeChange(val as ActionType)}
          value={data?.type ?? "IMPLEMENTATION"}
        >
          <SelectTrigger size="sm" className="w-[180px] shrink-0">
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Хэрэгжүүлэлтийн төрөл</SelectLabel>
              {ACTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function DepartmentNode({
  department,
  onSelectPosition,
}: {
  department: HeltesWithJobRelations;
  onSelectPosition: (posId: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-2 px-2"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">{department.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 pl-4 pt-1">
        {department.job_position && department.job_position.length > 0 && (
          <div className="space-y-0.5">
            {department.job_position.map((position) => (
              <PositionNode
                key={position.id}
                position={position}
                onSelectPosition={onSelectPosition}
              />
            ))}
          </div>
        )}
        {department.alba?.map((division) => (
          <DivisionNode
            key={division.id}
            division={division}
            onSelectPosition={onSelectPosition}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DivisionNode({
  division,
  onSelectPosition,
}: {
  division: AlbaWithJobRelations;
  onSelectPosition: (posId: string) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-full justify-start gap-2 px-2"
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-90",
            )}
          />
          <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-sm">{division.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 pl-4 pt-1">
        {division.job_position.map((position) => (
          <PositionNode
            key={position.id}
            position={position}
            onSelectPosition={onSelectPosition}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
