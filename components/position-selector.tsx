"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  X,
  ChevronLeft,
  Building2,
  Users,
  Folder,
  Briefcase,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface Organization {
  id: string;
  name: string;
  bteg_id: string;
}

interface Heltes {
  id: string;
  name: string;
  organization_id: string;
  bteg_id: string;
}

interface Alba {
  id: string;
  name: string;
  heltes_id: string | null;
  organization_id: string;
  bteg_id: string;
}

interface JobPosition {
  id: string;
  name: string;
  organization_id: string;
  alba_id: string | null;
  heltes_id: string | null;
  description?: string;
  is_active: boolean;
  organization?: Organization;
  heltes?: Heltes;
  alba?: Alba;
}

interface PositionSelectorProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  className?: string;
  multiple?: boolean;
}

type SelectionStep = "organization" | "department" | "positions";

export function PositionSelector({
  value,
  onChange,
  placeholder = "Ажлын байр сонгох...",
  className,
  multiple = false,
}: PositionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<SelectionStep>("organization");

  // Data states
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [heltes, setHeltes] = useState<Heltes[]>([]);
  const [albas, setAlbas] = useState<Alba[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);

  // Selection states
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<JobPosition[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Click outside handler
  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     if (
  //       dropdownRef.current &&
  //       !dropdownRef.current.contains(event.target as Node) &&
  //       inputRef.current &&
  //       !inputRef.current.contains(event.target as Node)
  //     ) {
  //       setIsOpen(false);
  //     }
  //   };

  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => {
  //     document.removeEventListener("mousedown", handleClickOutside);
  //   };
  // }, []);

  // Сонгогдсон position-уудыг ачаалах
  useEffect(() => {
    const fetchSelectedPositions = async () => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        setSelectedPositions([]);
        setSearchTerm("");
        return;
      }

      try {
        const ids = Array.isArray(value) ? value : [value];
        const { data: positions, error } = await supabase
          .from("job_position")
          .select(
            `
            *,
            organization:organization_id(*),
            heltes:heltes_id(*),
            alba:alba_id(*)
            `
          )
          .in("id", ids)
          .eq("is_active", true);

        if (!error && positions) {
          setSelectedPositions(positions);
        }
      } catch (error) {
        console.error("Error fetching selected positions:", error);
      }
    };

    fetchSelectedPositions();
  }, [value, multiple, supabase]);

  // Organizations авах (bteg_id-р шүүх)
  const fetchOrganizations = useCallback(
    async (query?: string) => {
      setIsLoading(true);
      try {
        let queryBuilder = supabase
          .from("organization")
          .select("*")
          .in("bteg_id", ["1", "2", "20"])
          .order("name");

        if (query) {
          queryBuilder = queryBuilder.ilike("name", `%${query}%`);
        }

        const { data, error } = await queryBuilder.limit(10);

        if (!error) {
          setOrganizations(data || []);
        }
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  // Бүх хэлтэс, алба, ажлын байруудыг авах
  const fetchDepartmentData = useCallback(
    async (organization: Organization, query?: string) => {
      setIsLoading(true);
      try {
        // Хэлтэсүүд
        const { data: heltesData, error: heltesError } = await supabase
          .from("heltes")
          .select("*")
          .eq("organization_id", organization.bteg_id)
          .order("name");

        // Албанууд (хэлтэсд харьяалагдсан ба харьяалагдаагүй)
        const { data: albasData, error: albasError } = await supabase
          .from("alba")
          .select("*")
          .eq("organization_id", organization.bteg_id)
          .order("name");

        // Ажлын байрууд (хэлтэс/албад харьяалагдсан ба харьяалагдаагүй)
        let positionsQuery = supabase
          .from("job_position")
          .select(
            `
            *,
            organization:organization_id(*),
            heltes:heltes_id(*),
            alba:alba_id(*)
            `
          )
          .eq("organization_id", organization.bteg_id)
          .eq("is_active", true)
          .order("name");

        if (query) {
          positionsQuery = positionsQuery.ilike("name", `%${query}%`);
        }

        const { data: positionsData, error: positionsError } =
          await positionsQuery;

        if (!heltesError) setHeltes(heltesData || []);
        if (!albasError) setAlbas(albasData || []);
        if (!positionsError) setPositions(positionsData || []);
      } catch (error) {
        console.error("Error fetching department data:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  // Хэлтэс доторх бүх ажлын байруудыг авах
  const fetchHeltesPositions = useCallback(
    async (organization: Organization, heltes: Heltes, query?: string) => {
      setIsLoading(true);
      try {
        let queryBuilder = supabase
          .from("job_position")
          .select(
            `
            *,
            organization:organization_id(*),
            heltes:heltes_id(*),
            alba:alba_id(*)
            `
          )
          .eq("organization_id", organization.bteg_id)
          .eq("heltes_id", heltes.bteg_id)
          .eq("is_active", true)
          .order("name");

        if (query) {
          queryBuilder = queryBuilder.ilike("name", `%${query}%`);
        }

        const { data, error } = await queryBuilder;

        if (!error) {
          setPositions(data || []);
        }
      } catch (error) {
        console.error("Error fetching heltes positions:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  // Step change handlers
  const handleOrganizationSelect = (org: Organization) => {
    setSelectedOrganization(org);
    setCurrentStep("department");
    fetchDepartmentData(org);
  };

  const handleHeltesSelect = (heltes: Heltes) => {
    setCurrentStep("positions");
    fetchHeltesPositions(selectedOrganization!, heltes);
  };

  const handleDirectPositionsSelect = () => {
    setCurrentStep("positions");
    // Байгууллагад шууд харьяалагдсан ажлын байрууд
    const directPositions = positions.filter(
      (position) => !position.heltes_id && !position.alba_id
    );
    setPositions(directPositions);
  };

  const handlePositionSelect = (position: JobPosition) => {
    if (multiple) {
      const isAlreadySelected = selectedPositions.some(
        (p) => p.id === position.id
      );
      let newSelected;

      if (isAlreadySelected) {
        newSelected = selectedPositions.filter((p) => p.id !== position.id);
      } else {
        newSelected = [...selectedPositions, position];
      }

      setSelectedPositions(newSelected);
      onChange(newSelected.map((p) => p.id));
    } else {
      setSelectedPositions([position]);
      onChange(position.id);
      setIsOpen(false);
      setSearchTerm(position.name);
    }
  };

  const handleRemovePosition = (positionId: string) => {
    const newSelected = selectedPositions.filter((p) => p.id !== positionId);
    setSelectedPositions(newSelected);
    onChange(multiple ? newSelected.map((p) => p.id) : "");
  };

  const handleBack = () => {
    switch (currentStep) {
      case "department":
        setCurrentStep("organization");
        setSelectedOrganization(null);
        setHeltes([]);
        setAlbas([]);
        setPositions([]);
        break;
      case "positions":
        setCurrentStep("department");
        setPositions([]);
        if (selectedOrganization) {
          fetchDepartmentData(selectedOrganization);
        }
        break;
    }
  };

  const handleClear = () => {
    setSelectedPositions([]);
    setSelectedOrganization(null);
    setCurrentStep("organization");
    setSearchTerm("");
    onChange(multiple ? [] : "");
    setIsOpen(false);
    setHeltes([]);
    setAlbas([]);
    setPositions([]);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (currentStep === "organization") {
      fetchOrganizations();
    }
  };

  const handleInputClick = () => {
    setIsOpen(true);
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
  };

  // Search effect
  useEffect(() => {
    if (!isOpen) return;

    const searchQuery = debouncedSearchTerm.trim();

    switch (currentStep) {
      case "organization":
        fetchOrganizations(searchQuery);
        break;
      case "department":
        if (selectedOrganization) {
          fetchDepartmentData(selectedOrganization, searchQuery);
        }
        break;
      case "positions":
        if (selectedOrganization) {
          // Хэрэв хэлтэсээс ирсэн бол хэлтэс доторх ажлын байруудыг хайх
          // Үгүй бол бүх ажлын байруудыг хайх
        }
        break;
    }
  }, [debouncedSearchTerm, currentStep, isOpen, selectedOrganization]);

  const renderOrganizationStep = () => {
    return (
      <div className="space-y-2 max-h-60 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Хайж байна...</div>
        ) : organizations.length > 0 ? (
          organizations.map((org) => (
            <div
              key={org.id}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleOrganizationSelect(org)}>
              <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {org.name}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500">
            {debouncedSearchTerm ? "Илэрц олдсонгүй" : "Мэдээлэл байхгүй"}
          </div>
        )}
      </div>
    );
  };

  const renderDepartmentStep = () => {
    // Хэлтэсүүд
    const filteredHeltes = heltes.filter(
      (heltes) =>
        !debouncedSearchTerm ||
        heltes.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );

    // Хэлтэсд харьяалагдаагүй албанууд
    const independentAlbas = albas.filter(
      (alba) =>
        (!alba.heltes_id || alba.heltes_id === "") &&
        (!debouncedSearchTerm ||
          alba.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
    );

    // Шууд ажлын байрууд (юунд ч харьяалагдаагүй)
    const directPositions = positions.filter(
      (position) =>
        !position.heltes_id &&
        !position.alba_id &&
        (!debouncedSearchTerm ||
          position.name
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()))
    );

    const hasContent =
      filteredHeltes.length > 0 ||
      independentAlbas.length > 0 ||
      directPositions.length > 0;

    return (
      <div className="space-y-4 max-h-60 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Ачаалж байна...</div>
        ) : hasContent ? (
          <>
            {/* Хэлтэсүүд */}
            {filteredHeltes.length > 0 && (
              <div>
                <div className="p-2 bg-gray-100 border-y">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    Хэлтэсүүд
                  </Label>
                </div>
                {filteredHeltes.map((heltes) => (
                  <div
                    key={heltes.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleHeltesSelect(heltes)}>
                    <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      {heltes.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Хэлтэс доторх ажлын байруудыг харах →
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Хэлтэсд харьяалагдаагүй албанууд */}
            {independentAlbas.length > 0 && (
              <div>
                <div className="p-2 bg-gray-100 border-y">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Албанууд (шууд)
                  </Label>
                </div>
                {independentAlbas.map((alba) => (
                  <div
                    key={alba.id}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      // Алба доторх ажлын байруудыг харуулах
                      const albaPositions = positions.filter(
                        (position) => position.alba_id === alba.bteg_id
                      );
                      setPositions(albaPositions);
                      setCurrentStep("positions");
                    }}>
                    <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {alba.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Алба доторх ажлын байруудыг харах →
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Шууд ажлын байрууд */}
            {directPositions.length > 0 && (
              <div>
                <div className="p-2 bg-gray-100 border-y">
                  <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Шууд ажлын байрууд
                  </Label>
                </div>
                {directPositions.map((position) => {
                  const isSelected = selectedPositions.some(
                    (p) => p.id === position.id
                  );
                  return (
                    <div
                      key={position.id}
                      className={`p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                        isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handlePositionSelect(position)}>
                      <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {position.name}
                        {isSelected && (
                          <span className="ml-auto text-xs text-blue-600">
                            ✓
                          </span>
                        )}
                      </div>
                      {position.description && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {position.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="p-4 text-center text-gray-500">
            {debouncedSearchTerm ? "Илэрц олдсонгүй" : "Мэдээлэл байхгүй"}
          </div>
        )}
      </div>
    );
  };

  const renderPositionsStep = () => {
    const filteredPositions = positions.filter(
      (position) =>
        !debouncedSearchTerm ||
        position.name
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase()) ||
        position.description
          ?.toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase())
    );

    return (
      <div className="space-y-2 max-h-60 overflow-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">Хайж байна...</div>
        ) : filteredPositions.length > 0 ? (
          filteredPositions.map((position) => {
            const isSelected = selectedPositions.some(
              (p) => p.id === position.id
            );
            return (
              <div
                key={position.id}
                className={`p-3 cursor-pointer border-b last:border-b-0 transition-colors ${
                  isSelected
                    ? "bg-blue-50 border-l-4 border-l-blue-500"
                    : "hover:bg-gray-50 border-l-4 border-l-transparent"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePositionSelect(position)}>
                <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  {position.name}
                  {isSelected && (
                    <span className="ml-auto text-xs text-blue-600">✓</span>
                  )}
                </div>
                {position.description && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {position.description}
                  </div>
                )}
                {(position.heltes || position.alba) && (
                  <div className="text-xs text-gray-400 mt-1">
                    {position.heltes?.name && `Хэлтэс: ${position.heltes.name}`}
                    {position.alba?.name && ` • Алба: ${position.alba.name}`}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-gray-500">
            {debouncedSearchTerm ? "Илэрц олдсонгүй" : "Ажлын байр байхгүй"}
          </div>
        )}
      </div>
    );
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case "organization":
        return "Байгууллага сонгох";
      case "department":
        return `${selectedOrganization?.name} - Хэлтэс, Алба, Ажлын байр`;
      case "positions":
        return `${selectedOrganization?.name} - Ажлын байрууд`;
      default:
        return "";
    }
  };

  const getDisplayText = () => {
    if (selectedPositions.length === 0) return "";

    if (multiple) {
      return `${selectedPositions.length} ажлын байр сонгогдсон`;
    } else {
      return selectedPositions[0]?.name || "";
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm || getDisplayText()}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={handleInputFocus}
          onClick={handleInputClick}
          placeholder={placeholder}
          className="pl-10 pr-10 cursor-pointer"
          readOnly={!isOpen}
        />
        {(selectedPositions.length > 0 || searchTerm) && (
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

      {/* Сонгогдсон position-ууд */}
      {selectedPositions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedPositions.map((position) => (
            <Badge
              key={position.id}
              variant="secondary"
              className="flex items-center gap-1">
              {position.name}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => handleRemovePosition(position.id)}>
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Selection Modal */}
      {isOpen && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg border border-gray-200">
          <CardContent className="p-0">
            {/* Header */}
            <div className="p-3 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentStep !== "organization" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleBack}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  )}
                  <Label className="font-medium text-sm">
                    {getStepTitle()}
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleCloseDropdown}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`${getStepTitle()} хайх...`}
                className="w-full"
              />
            </div>

            {/* Content */}
            {currentStep === "organization" && renderOrganizationStep()}
            {currentStep === "department" && renderDepartmentStep()}
            {currentStep === "positions" && renderPositionsStep()}

            {/* Footer */}
            {multiple &&
              currentStep === "positions" &&
              selectedPositions.length > 0 && (
                <div className="p-3 border-t bg-gray-50">
                  <Button
                    type="button"
                    onClick={handleCloseDropdown}
                    className="w-full">
                    Дуусгах ({selectedPositions.length} сонгогдсон)
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
