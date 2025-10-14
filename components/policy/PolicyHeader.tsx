"use client";

import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Policy } from "@/types/types";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useState } from "react";

interface PolicyHeaderProps {
  policyData: Policy;
  setPolicyData: React.Dispatch<React.SetStateAction<Policy>>;
  isProcessing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const PolicyHeader = ({
  policyData,
  setPolicyData,
  isProcessing,
  onSubmit,
}: PolicyHeaderProps) => {
  const [date, setDate] = useState<Date | undefined>(
    policyData.approved_date || undefined
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    setPolicyData((prev) => ({
      ...prev,
      approved_date: selectedDate || null,
    }));
  };

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Шинэ Журам Үүсгэх</h1>
        <Button
          type="submit"
          disabled={isProcessing}
          aria-label="Журам хадгалах">
          Хадгалах
        </Button>
      </div>

      <div className="flex flex-wrap my-4 container w-full shadow-md p-3 justify-between gap-4">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700">
            Журмын дугаар
          </label>
          <Input
            required
            value={policyData.reference_code}
            onChange={(e) =>
              setPolicyData((prev) => ({
                ...prev,
                reference_code: e.target.value,
              }))
            }
            className="mt-1 p-2 w-full border border-gray-300 rounded"
            placeholder="Журмын дугаарыг оруулна уу"
            disabled={isProcessing}
          />
        </div>

        <div className="flex-1 min-w-[400px]">
          <label className="block text-sm font-medium text-gray-700">
            Журмын нэр
          </label>
          <Textarea
            required
            value={policyData.name}
            onChange={(e) =>
              setPolicyData((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            className="mt-1 p-2 w-full border border-gray-300 rounded"
            placeholder="Журмын нэрийг оруулна уу"
            maxLength={250}
            disabled={isProcessing}
          />
        </div>

        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700">
            Журмын баталсан огноо
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal mt-1",
                  !date && "text-muted-foreground"
                )}
                disabled={isProcessing}
                type="button">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "yyyy/MM/dd") : <span>Огноо сонгох</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={handleDateSelect}
                initialFocus
                disabled={isProcessing}
                fromYear={1900}
                toYear={new Date().getFullYear()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </form>
  );
};
