"use client";
import React, { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight, Building2, Users, Briefcase, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getClauseJobPosition,
  createClauseJobPosition,
  updateClauseJobPosition,
} from "@/actions/clause-position";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  HeltesWithJobRelations,
  OrganizationWithJobRelations,
  JobPosition,
  ClauseJobPosition,
  AlbaWithJobRelations,
} from "@/types/types";
import { Button } from "../ui/button";

interface Props {
  organization: OrganizationWithJobRelations;
}

type Params = { clause_id: string };

type ActionType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

const actionTypes: { value: ActionType; label: string }[] = [
  { value: "IMPLEMENTATION", label: "Хэрэгжүүлэлт" },
  { value: "MONITORING", label: "Хяналт" },
  { value: "VERIFICATION", label: "Баталгаажуулалт" },
  { value: "DEPLOYMENT", label: "Нэвтрүүлэлт" },
];

export default function OrganizationNode({ organization }: Props) {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <Building2 className="h-5 w-5 ml-1 mr-2 text-blue-600" />
          <span className="font-semibold text-lg">{organization.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-6 mt-2 space-y-2">
        {organization.job_position && organization.job_position.length > 0 && (
          <div className="ml-4 space-y-1">
            {organization.job_position.map((position) => (
              <PositionNode key={position.id} position={position} />
            ))}
          </div>
        )}

        {organization.heltes.map((helts) => (
          <DepartmentNode key={helts.id} department={helts} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PositionNode({ position }: { position: JobPosition }) {
  const [data, setData] = useState<ClauseJobPosition | null>(null);
  const { clause_id } = useParams<Params>();

  const handleTypeChange = async (value: ActionType) => {
    if (data) {
      const updated = await updateClauseJobPosition({
        id: data.id,
        type: value,
      });
      setData(updated);
      const valueLabel =
        actionTypes.find((type) => type.value === value)?.label ?? value;
      toast.success(
        <span>
          <strong>{valueLabel}</strong> төрөлтэй амжилттай сонгогдлоо
        </span>
      );
    }
  };

  useEffect(() => {
    if (!clause_id || !position?.id) return;

    const fetchOrCreate = async () => {
      const existing = await getClauseJobPosition({
        clauseId: clause_id,
        jobPositionId: position.id,
      });
      if (existing) {
        setData(existing);
      } else {
        setData(null);
      }
    };

    fetchOrCreate();
  }, [clause_id, position.id]);

  const handleCheckChange = async (checked: boolean | "indeterminate") => {
    if (!clause_id || !position?.id) return;
    const newCheckedState = checked === true;

    const existingClauseJobPosition = await getClauseJobPosition({
      clauseId: clause_id,
      jobPositionId: position.id,
    });

    if (existingClauseJobPosition) {
      const updated = await updateClauseJobPosition({
        id: existingClauseJobPosition.id,
        is_checked: newCheckedState,
      });
      setData(updated);

      if (newCheckedState) {
        const valueLabel =
          actionTypes.find((type) => type.value === updated.type)?.label ??
          updated.type;
        toast.success(
          <span>
            <strong>{valueLabel}</strong> төрөлтэй амжилттай сонгогдлоо
          </span>
        );
      } else {
        toast.info("Ажлын байрыг холболтоос салгалаа");
      }
    } else {
      // Шинээр үүсгэх үед checked=true байх ёстой
      const created = await createClauseJobPosition({
        clauseId: clause_id,
        jobPositionId: position.id,
        is_checked: true,
        type: "IMPLEMENTATION",
      });
      setData(created);
      const valueLabel =
        actionTypes.find((type) => type.value === created.type)?.label ??
        created.type;
      toast.success(
        <span>
          <strong>{valueLabel}</strong> төрөлтэй амжилттай сонгогдлоо
        </span>
      );
    }
  };
  <Checkbox
    checked={data?.is_checked || false}
    onCheckedChange={handleCheckChange}
    className="border-gray-300
     hover:border-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mr-2"
  />;

  return (
    <div className="flex items-center p-2 ml-4 rounded-md hover:bg-muted/50 h-10">
      <Checkbox
        checked={data?.is_checked || false}
        onCheckedChange={handleCheckChange}
        className="border-gray-300 hover:border-blue-500 
        data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mr-2"
      />
      <User className="h-3 w-3 mr-2 text-gray-500" />
      <span className="text-sm">{position.name}</span>
      {data?.is_checked && (
        <Select
          onValueChange={(val) => handleTypeChange(val as ActionType)}
          defaultValue={data?.type}
          value={data?.type}>
          <SelectTrigger className="ml-2 w-[220px] border-gray-300">
            <SelectValue placeholder="Төрөл сонгох" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Хэрэгжүүлэлтийн төрөл</SelectLabel>
              {actionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
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
}: {
  department: HeltesWithJobRelations;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <Users className="h-4 w-4 ml-1 mr-2 text-green-600" />
          <span className="font-semibold">{department.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-6 mt-2 space-y-2">
        {department.job_position && department.job_position.length > 0 && (
          <div className="ml-4 space-y-1">
            {department.job_position.map((position) => (
              <PositionNode key={position.id} position={position} />
            ))}
          </div>
        )}

        {department.alba &&
          department.alba.map((division) => (
            <DivisionNode key={division.id} division={division} />
          ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DivisionNode({ division }: { division: AlbaWithJobRelations }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start p-2 h-auto">
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <Briefcase className="h-4 w-4 ml-1 mr-2 text-purple-600" />
          <span className="font-medium text-sm">{division.name}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="ml-6 mt-2 space-y-1">
        {division.job_position.map((position) => (
          <PositionNode key={position.id} position={position} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
