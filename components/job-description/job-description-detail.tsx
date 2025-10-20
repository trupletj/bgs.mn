import type React from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface JobPosition {
  id: string;
  name: string;
  organization_id: string;
  alba_id: string;
  heltes_id: string;
  department?: string;
}

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
  job_position?: JobPosition;
  supervisors: JobPosition[];
  subordinates: JobPosition[];
}

interface JobDescriptionDetailProps {
  data: JobDescriptionData;
}

export function JobDescriptionDetail({ data }: JobDescriptionDetailProps) {
  const parseCommunicationScope = (): CommunicationScope => {
    try {
      return data.communication_scope
        ? JSON.parse(data.communication_scope)
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

  const getCommunicationScopeText = (): string => {
    const scope = parseCommunicationScope();
    const internal: string[] = [];
    const external: string[] = [];

    if (scope.company_internal.department_heads) {
      internal.push("Хэлтэс/албаны дарга нар");
    }
    if (scope.company_internal.employees) {
      internal.push("Бусад ажилчид");
    }
    if (scope.external.clients) {
      external.push("Харилцагчид");
    }
    if (scope.external.contractors) {
      external.push("Гүйцэтгэгчид");
    }

    const parts: string[] = [];
    if (internal.length > 0) {
      parts.push(`Компани дотор: ${internal.join(", ")}`);
    }
    if (external.length > 0) {
      parts.push(`Гадна: ${external.join(", ")}`);
    }

    return parts.length > 0 ? parts.join("\n") : "-";
  };

  return (
    <div className="mx-auto max-w-5xl p-4">
      {/* Action Buttons */}
      <div className="mb-6 flex justify-end gap-3">
        <Link href="/job_descriptions">
          <Button variant="outline">Буцах</Button>
        </Link>
        <Link href={`/job-descriptions/${data.id}/edit`}>
          <Button variant="default">Засварлах</Button>
        </Link>
      </div>

      {/* Main Document Card */}
      <Card className="border-2 bg-card p-8 shadow-sm md:p-12">
        {/* Document Header */}
        <header className="mb-8 text-center">
          <h1 className="mb-4 font-serif text-3xl font-bold uppercase tracking-wide md:text-4xl">
            Албан тушаалын тодорхойлолт
          </h1>
          <div className="mt-6 flex flex-col gap-2 text-base md:flex-row md:justify-center md:gap-8">
            <div className="font-medium">
              <span className="text-muted-foreground">Код:</span> {data.a_code}
            </div>
            <div className="font-medium">
              <span className="text-muted-foreground">Албан тушаал:</span>{" "}
              {data.job_position?.name || data.title}
            </div>
          </div>
        </header>

        <Separator className="my-8" />

        {/* A. General Information */}
        <Section title="А. Нийтлэг үндэслэл">
          <InfoRow label="Албан тушаалын нэр" value={data.title} />
          <InfoRow
            label="Үндэсний ажил мэргэжлийн ангилалын код"
            value={data.a_code}
          />
          <InfoRow label="Албан тушаалын код" value={data.at_code} />

          <InfoRow
            label="Шууд харьяалагдах албан тушаал"
            value={
              data.supervisors?.length > 0
                ? data.supervisors.map((s) => s.name).join(", ")
                : "-"
            }
          />

          <InfoRow
            label="Шууд удирдах албан тушаал"
            value={
              data.subordinates?.length > 0
                ? data.subordinates.map((s) => s.name).join(", ")
                : "-"
            }
          />

          <InfoRow
            label="Хөдөлмөрийн нөхцөл"
            value={data.job_condition || "-"}
          />

          <InfoRow
            label="Харилцах хүрээ"
            value={getCommunicationScopeText()}
            multiline
          />
        </Section>

        {/* B. Detailed Job Information */}
        <Section title="Б. Албан тушаалын дэлгэрэнгүй мэдээлэл">
          <InfoRow
            label="Албан тушаалын зорилго"
            value={data.purpose}
            multiline
          />
          <InfoRow label="Ажлын хуваарь" value={data.schedule} multiline />
          <InfoRow label="Өдрийн ажлын цаг" value={data.daily_hours} />
          <InfoRow label="Цайны цаг" value={data.break_time} />
        </Section>

        {/* C. Job Duties */}
        <Section title="С. Албан тушаалын гүйцэтгэх үүрэг">
          {data.duties && data.duties.length > 0 ? (
            <table className="w-full border-collapse border border-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="border border-border px-4 py-3 text-left font-semibold w-16">
                    №
                  </th>
                  <th className="border border-border px-4 py-3 text-left font-semibold">
                    Ажил үүрэг
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.duties.map((duty, index) => (
                  <tr key={index} className="hover:bg-muted/30">
                    <td className="border border-border px-4 py-3 text-center align-top">
                      {index + 1}
                    </td>
                    <td className="border border-border px-4 py-3">{duty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground">Мэдээлэл байхгүй</p>
          )}
        </Section>

        {/* D. Requirements */}
        <Section title="Д. Албан тушаалд тавигдах шаардлага">
          <div className="space-y-6">
            <SubSection title="Ерөнхий шаардлага">
              <InfoRow
                label="Боловсролын түвшин"
                value={data.education_level}
                multiline
              />
              <InfoRow
                label="Ажлын туршлага"
                value={data.work_experience}
                multiline
              />
            </SubSection>

            {data.general_skills && data.general_skills.length > 0 && (
              <SubSection title="Ерөнхий ур чадвар">
                <List items={data.general_skills} />
              </SubSection>
            )}

            {data.professional_skills &&
              data.professional_skills.length > 0 && (
                <SubSection title="Мэргэжлийн ур чадвар">
                  <List items={data.professional_skills} numbered />
                </SubSection>
              )}

            {data.additional_courses && data.additional_courses.length > 0 && (
              <SubSection title="Хамрагдсан байвал зохих сургалт">
                <List items={data.additional_courses} />
              </SubSection>
            )}
          </div>
        </Section>

        {/* E. Other Factors */}
        <Section title="Е. Бусад хүчин зүйлс">
          <div className="space-y-6">
            {data.resources && (
              <SubSection title="Нөөц хэрэгсэл">
                <p className="leading-relaxed">{data.resources}</p>
              </SubSection>
            )}

            {data.authority && data.authority.length > 0 && (
              <SubSection title="Эрх мэдэл">
                <List items={data.authority} numbered />
              </SubSection>
            )}

            {data.responsibilities && data.responsibilities.length > 0 && (
              <SubSection title="Хариуцлага">
                <List items={data.responsibilities} numbered />
              </SubSection>
            )}

            {data.property_liability && data.property_liability.length > 0 && (
              <SubSection title="Эд хөрөнгийн хариуцлага">
                <p className="leading-relaxed">
                  {data.property_liability.join(" ")}
                </p>
              </SubSection>
            )}

            {data.relevant_laws && data.relevant_laws.length > 0 && (
              <SubSection title="Холбогдох хууль тогтоомж">
                <List items={data.relevant_laws} numbered />
              </SubSection>
            )}

            <SubSection title="Бусад">
              <List
                items={[
                  'Энэхүү албан тушаалын тодорхойлолт нь зөвхөн "БТЕГ" ХХК-д ажиллах тохиолдолд мөрдлөг болно.',
                  "Маргаантай асуудал гарвал хөдөлмөр олгогч болон ажилтан харилцан ярилцаж шийдвэрлэнэ.",
                  "Энэхүү баримт бичиг нь хөдөлмөрийн гэрээний салшгүй хэсэг болно.",
                ]}
                numbered
              />
            </SubSection>
          </div>
        </Section>
      </Card>
    </div>
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
    <section className="mb-10">
      <h2 className="mb-5 border-b pb-2 font-serif text-2xl font-semibold">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="pl-4">{children}</div>
    </div>
  );
}

function InfoRow({
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
    <div className="grid grid-cols-1 gap-2 py-2 md:grid-cols-[280px_1fr]">
      <span className="font-medium">{label}:</span>
      {multiline ? (
        <pre className="whitespace-pre-wrap font-sans leading-relaxed">
          {value}
        </pre>
      ) : (
        <span className="leading-relaxed">{value}</span>
      )}
    </div>
  );
}

function List({
  items,
  numbered = false,
}: {
  items: string[];
  numbered?: boolean;
}) {
  if (!items || items.length === 0) return null;

  if (numbered) {
    return (
      <ol className="list-decimal space-y-2 pl-6 leading-relaxed">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ol>
    );
  }

  return (
    <ul className="space-y-2 leading-relaxed">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="text-muted-foreground">•</span>
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}
