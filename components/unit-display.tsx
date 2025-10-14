import { UNIT_OPTIONS, type UnitType } from "@/types/types";

interface UnitDisplayProps {
  unit: UnitType;
  className?: string;
}

export function UnitDisplay({ unit, className = "" }: UnitDisplayProps) {
  const unitConfig = UNIT_OPTIONS.find((u) => u.value === unit);

  if (!unitConfig) {
    return <span className={className}>{unit}</span>;
  }

  return <span className={className}>{unitConfig.label}</span>;
}
