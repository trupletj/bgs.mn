"use client";

import React, { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/utils/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface JobDescriptionData {
  id: string;
  title: string;
  job_position_id: string;
  a_code: string;
  at_code: string;
  supervisor_pos_id: string | string[];
  subordinate_pos_id: string | string[];
  communication_scope: string;
  job_condition: string;
  purpose: string;
  schedule: string;
  daily_hours: string;
  break_time: string;
  duties: string[];
  education_level: string;
  work_experience: string;
  general_skills: string[];
  professional_skills: string[];
  additional_courses: string[];
  resources: string;
  authority: string[];
  responsibilities: string[];
  property_liability: string[];
  relevant_laws: string[];
  note: string;
  job_position?: { id: string; name: string };
  supervisors: Array<{ id: string; name: string }>;
  subordinates: Array<{ id: string; name: string }>;
}

interface JobDescriptionSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  positionId: string;
}

export function JobDescriptionSheet({
  isOpen,
  onOpenChange,
  positionId,
}: JobDescriptionSheetProps) {
  const [data, setData] = useState<JobDescriptionData | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen || !positionId) return;

    const fetchJobDescription = async () => {
      setLoading(true);
      try {
        const { data: jobDescriptions, error } = await supabase
          .from("job_description")
          .select("*")
          .eq("job_position_id", positionId)
          .eq("is_deleted", false)
          .single();

        if (error) {
          console.error("[v0] Fetch error:", error);
          setData(null);
          return;
        }

        if (jobDescriptions) {
          const supervisorIds = jobDescriptions.supervisor_pos_id
            ? Array.isArray(jobDescriptions.supervisor_pos_id)
              ? jobDescriptions.supervisor_pos_id
              : jobDescriptions.supervisor_pos_id.split(",").filter(Boolean)
            : [];

          const subordinateIds = jobDescriptions.subordinate_pos_id
            ? Array.isArray(jobDescriptions.subordinate_pos_id)
              ? jobDescriptions.subordinate_pos_id
              : jobDescriptions.subordinate_pos_id.split(",").filter(Boolean)
            : [];

          const { data: jobPosition } = await supabase
            .from("job_position")
            .select("id, name, organization_id, alba_id, heltes_id")
            .eq("id", jobDescriptions.job_position_id)
            .single();

          const { data: supervisors } =
            supervisorIds.length > 0
              ? await supabase
                  .from("job_position")
                  .select("id, name")
                  .in("id", supervisorIds)
              : { data: [] };

          const { data: subordinates } =
            subordinateIds.length > 0
              ? await supabase
                  .from("job_position")
                  .select("id, name")
                  .in("id", subordinateIds)
              : { data: [] };

          setData({
            ...jobDescriptions,
            job_position: jobPosition || undefined,
            supervisors: supervisors || [],
            subordinates: subordinates || [],
          });
        }
      } catch (error) {
        console.error("[v0] Error fetching job description:", error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchJobDescription();
  }, [isOpen, positionId, supabase]);

  const parseCommunicationScope = () => {
    if (!data?.communication_scope) return { internal: [], external: [] };
    try {
      const scope = JSON.parse(data.communication_scope);
      const internal: string[] = [];
      const external: string[] = [];

      if (scope.company_internal?.department_heads)
        internal.push("Хэлтэс/албаны дарга нар");
      if (scope.company_internal?.employees) internal.push("Бусад ажилчид");
      if (scope.external?.clients) external.push("Харилцагчид");
      if (scope.external?.contractors) external.push("Гүйцэтгэгчид");

      return { internal, external };
    } catch {
      return { internal: [], external: [] };
    }
  };

  const commScope = parseCommunicationScope();

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="min-w-1/2 overflow-x-hidden flex flex-col p-0 bg-white">
        <SheetHeader className="px-8 py-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between w-full">
            <SheetTitle className="text-2xl font-bold text-gray-900">
              {loading ? "Ачаалж байна..." : data?.title || "Албан тушаал"}
            </SheetTitle>
          </div>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Ачаалж байна...</p>
          </div>
        ) : data ? (
          <ScrollArea className="flex-1">
            <div className="px-8 py-6 space-y-7">
              {/* Header Info */}
              <div className="space-y-3 pb-4 border-b border-gray-100">
                <div className="text-base">
                  <span className="font-semibold text-gray-900">Код:</span>
                  <span className="text-gray-700 ml-3">{data.a_code}</span>
                </div>
                <div className="text-base">
                  <span className="font-semibold text-gray-900">
                    Албан тушаалын код:
                  </span>
                  <span className="text-gray-700 ml-3">{data.at_code}</span>
                </div>
              </div>

              {/* General Information */}
              <Section title="Нийтлэг үндэслэл">
                <InfoItem
                  label="Хөдөлмөрийн нөхцөл"
                  value={data.job_condition || "-"}
                />
                {data.supervisors.length > 0 && (
                  <InfoItem
                    label="Харьяалагдах албан тушаал"
                    value={data.supervisors.map((s) => s.name).join(", ")}
                  />
                )}
                {data.subordinates.length > 0 && (
                  <InfoItem
                    label="Удирдах албан тушаал"
                    value={data.subordinates.map((s) => s.name).join(", ")}
                  />
                )}
                {(commScope.internal.length > 0 ||
                  commScope.external.length > 0) && (
                  <InfoItem
                    label="Харилцах хүрээ"
                    value={[
                      commScope.internal.length > 0 &&
                        `Компани дотор: ${commScope.internal.join(", ")}`,
                      commScope.external.length > 0 &&
                        `Гадна: ${commScope.external.join(", ")}`,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  />
                )}
              </Section>

              {/* Job Details */}
              <Section title="Албан тушаалын дэлгэрэнгүй мэдээлэл">
                <InfoItem
                  label="Зорилго"
                  value={data.purpose || "-"}
                  multiline
                />
                <InfoItem
                  label="Ажлын хуваарь"
                  value={data.schedule || "-"}
                  multiline
                />
                <InfoItem label="Ажлын цаг" value={data.daily_hours || "-"} />
                <InfoItem label="Цайны цаг" value={data.break_time || "-"} />
              </Section>

              {/* Requirements */}
              {(data.education_level ||
                data.work_experience ||
                data.general_skills?.length > 0 ||
                data.professional_skills?.length > 0) && (
                <Section title="Шаардлага">
                  {data.education_level && (
                    <InfoItem
                      label="Боловсролын түвшин"
                      value={data.education_level}
                      multiline
                    />
                  )}
                  {data.work_experience && (
                    <InfoItem
                      label="Ажлын туршлага"
                      value={data.work_experience}
                      multiline
                    />
                  )}
                  {data.general_skills?.length > 0 && (
                    <div>
                      <div className="font-semibold text-base text-gray-900 mb-3">
                        Ерөнхий ур чадвар
                      </div>
                      <ul className="list-disc list-inside space-y-2 text-base">
                        {data.general_skills.map((skill, i) => (
                          <li key={i} className="text-gray-700">
                            {skill}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.professional_skills?.length > 0 && (
                    <div>
                      <div className="font-semibold text-base text-gray-900 mb-3">
                        Мэргэжлийн ур чадвар
                      </div>
                      <ol className="list-decimal list-inside space-y-2 text-base">
                        {data.professional_skills.map((skill, i) => (
                          <li key={i} className="text-gray-700">
                            {skill}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Section>
              )}

              {/* Duties */}
              {data.duties?.length > 0 && (
                <Section title="Гүйцэтгэх үүрэг">
                  <ol className="list-decimal list-inside space-y-2 text-base">
                    {data.duties.slice(0, 5).map((duty, i) => (
                      <li key={i} className="text-gray-700">
                        {duty}
                      </li>
                    ))}
                    {data.duties.length > 5 && (
                      <li className="text-gray-600 italic">
                        болон {data.duties.length - 5} үүрэг өөр
                      </li>
                    )}
                  </ol>
                </Section>
              )}

              {/* Authority */}
              {data.authority?.length > 0 && (
                <Section title="Эрх мэдэл">
                  <ol className="list-decimal list-inside space-y-2 text-base">
                    {data.authority.slice(0, 3).map((auth, i) => (
                      <li key={i} className="text-gray-700">
                        {auth}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {/* Bottom padding for scroll */}
              <div className="h-6" />
            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Мэдээлэл олдсонгүй</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-2 border-b border-gray-100">
      <h3 className="font-bold text-lg text-gray-900">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="text-base">
      <span className="font-semibold text-gray-900">{label}:</span>
      <div className={multiline ? "whitespace-pre-wrap mt-2" : ""}>
        <span className="text-gray-700 ml-3">{value}</span>
      </div>
    </div>
  );
}
