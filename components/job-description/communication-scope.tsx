"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Users } from "lucide-react";

interface CommunicationScope {
  company_internal: {
    department_heads: boolean;
    employees: boolean;
  };
  external: {
    clients: boolean;
    contractors: boolean;
  };
}

interface CommunicationScopeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CommunicationScopeSelector({
  value,
  onChange,
}: CommunicationScopeSelectorProps) {
  const parseValue = (val: string): CommunicationScope => {
    try {
      return val
        ? JSON.parse(val)
        : {
            company_internal: { department_heads: false, employees: false },
            external: { clients: false, contractors: false },
          };
    } catch {
      return {
        company_internal: { department_heads: false, employees: false },
        external: { clients: false, contractors: false },
      };
    }
  };

  const scope = parseValue(value);

  const handleChange = (
    section: keyof CommunicationScope,
    field: string,
    checked: boolean
  ) => {
    const newScope = {
      ...scope,
      [section]: {
        ...scope[section],
        [field]: checked,
      },
    };
    onChange(JSON.stringify(newScope));
  };

  const getDisplayText = () => {
    const internal = [];
    const external = [];

    if (scope.company_internal.department_heads)
      internal.push("Хэлтэс/албаны дарга");
    if (scope.company_internal.employees) internal.push("Ажилтнууд");
    if (scope.external.clients) external.push("Харилцагчид");
    if (scope.external.contractors) external.push("Туслан гүйцэтгэгч компани");

    const parts = [];
    if (internal.length > 0)
      parts.push(`Компани дотор: ${internal.join(", ")}`);
    if (external.length > 0) parts.push(`Гадна: ${external.join(", ")}`);

    return parts.join(" | ") || "Сонгоогүй";
  };

  return (
    <div className="space-y-6">
      {/* <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-sm font-medium text-foreground">Харилцааны хүрээ:</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {getDisplayText()}
        </p>
      </div> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-2 hover:border-primary transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <Label className="font-semibold text-base">Компани дотор</Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3 group">
              <Checkbox
                id="department_heads"
                checked={scope.company_internal.department_heads}
                onCheckedChange={(checked) =>
                  handleChange(
                    "company_internal",
                    "department_heads",
                    checked as boolean
                  )
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="department_heads"
                className="text-sm font-normal leading-relaxed cursor-pointer group-hover:text-foreground transition-colors">
                Хэлтэс/албаны дарга
              </Label>
            </div>
            <div className="flex items-start space-x-3 group">
              <Checkbox
                id="employees"
                checked={scope.company_internal.employees}
                onCheckedChange={(checked) =>
                  handleChange(
                    "company_internal",
                    "employees",
                    checked as boolean
                  )
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="employees"
                className="text-sm font-normal leading-relaxed cursor-pointer group-hover:text-foreground transition-colors">
                Ажилтнууд
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <Label className="font-semibold text-base">Гадна</Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3 group">
              <Checkbox
                id="clients"
                checked={scope.external.clients}
                onCheckedChange={(checked) =>
                  handleChange("external", "clients", checked as boolean)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="clients"
                className="text-sm font-normal leading-relaxed cursor-pointer group-hover:text-foreground transition-colors">
                Харилцагчид
              </Label>
            </div>
            <div className="flex items-start space-x-3 group">
              <Checkbox
                id="contractors"
                checked={scope.external.contractors}
                onCheckedChange={(checked) =>
                  handleChange("external", "contractors", checked as boolean)
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="contractors"
                className="text-sm font-normal leading-relaxed cursor-pointer group-hover:text-foreground transition-colors">
                Туслан гүйцэтгэгч компани
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
