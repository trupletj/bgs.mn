"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebounce } from "use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface JobPosition {
  id: string;
  name: string;
  organization_id: string;
  alba_id: string;
  heltes_id: string;
  bteg_id?: string;
  gazar_id?: string;
  description?: string;
  is_active: boolean;
  organization: {
    id: string;
    name: string;
  };
  heltes: {
    id: string;
    name: string;
  };
  alba: {
    id: string;
    name: string;
  };
}

interface PositionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PositionSelector({
  value,
  onChange,
  placeholder = "Ажлын байр хайх...",
  className,
}: PositionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<JobPosition | null>(
    null
  );

  const supabase = createClient();

  // Сонгогдсон position-ыг ачаалах
  useEffect(() => {
    const fetchSelectedPosition = async () => {
      if (value) {
        try {
          const { data: position, error } = await supabase
            .from("job_position")
            .select("*")
            .eq("id", value)
            .eq("is_active", true)
            .single();

          if (!error && position) {
            setSelectedPosition(position);
            setSearchTerm(position.name);
          }
        } catch (error) {
          console.error("Error fetching selected position:", error);
        }
      } else {
        setSelectedPosition(null);
        setSearchTerm("");
      }
    };

    fetchSelectedPosition();
  }, [value, supabase]);

  // Хайлт хийх
  const searchPositions = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setPositions([]);
        return;
      }

      setIsLoading(true);
      try {
        const { data: positions, error } = await supabase
          .from("job_position")
          .select("*, organization(*), heltes(*), alba(*)")
          .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
          .eq("is_active", true)
          .limit(10);

        if (!error) {
          setPositions(positions || []);
        } else {
          console.error("Error searching positions:", error);
          setPositions([]);
        }
      } catch (error) {
        console.error("Error searching positions:", error);
        setPositions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (debouncedSearchTerm) {
      searchPositions(debouncedSearchTerm);
    } else {
      setPositions([]);
    }
  }, [debouncedSearchTerm, searchPositions]);

  const handleSelect = (position: JobPosition) => {
    setSelectedPosition(position);
    setSearchTerm(position.name);
    onChange(position.id);
    setIsOpen(false);
    setPositions([]);
  };

  const handleClear = () => {
    setSelectedPosition(null);
    setSearchTerm("");
    onChange("");
    setPositions([]);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value && !selectedPosition) {
      setIsOpen(true);
    } else if (!value) {
      setIsOpen(false);
    }
  };

  const handleInputFocus = () => {
    if (searchTerm && !selectedPosition) {
      setIsOpen(true);
    }
  };

  const handleInputBlur = () => {
    // Delay closing to allow for item selection
    setTimeout(() => setIsOpen(false), 200);
  };

  // Organization, department, алба зэргийг харуулах текст бэлтгэх
  const getPositionDetails = (position: JobPosition) => {
    const details = [];
    if (position.organization)
      details.push(`Байгууллага: ${position.organization.name}`);
    if (position.heltes) details.push(`Хэлтэс: ${position.heltes.name}`);
    if (position.alba) details.push(`Алба: ${position.alba.name}`);
    return details.join(" • ");
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {selectedPosition && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
            onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isOpen && (positions.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Хайж байна...</div>
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                onClick={() => handleSelect(position)}>
                <div className="font-medium text-sm text-gray-900">
                  {position.name}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {getPositionDetails(position)}
                </div>
                {position.description && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {position.description}
                  </div>
                )}
              </div>
            ))
          )}

          {!isLoading && positions.length === 0 && debouncedSearchTerm && (
            <div className="p-4 text-center text-gray-500">Илэрц олдсонгүй</div>
          )}
        </div>
      )}
    </div>
  );
}
