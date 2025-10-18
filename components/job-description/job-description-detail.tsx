import type React from "react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "../ui/button";
import Link from "next/link";

interface JobPosition {
  id: string;
  name: string;
  organization_id: string;
  alba_id: string;
  heltes_id: string;
  department?: string;
}

interface JobDescriptionData {
  id: string;
  title: string;
  job_position_id: string;
  code: string;
  supervisor_pos_id: string;
  subordinate_pos_id: string;
  communication_scope: string;
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
  supervisor?: JobPosition;
  subordinate?: JobPosition;
}

interface JobDescriptionDetailProps {
  data: JobDescriptionData;
}

export function JobDescriptionDetail({ data }: JobDescriptionDetailProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex justify-end mb-4">
        <div className="flex-shrink-0 ml-4">
          <Link href="/job_descriptions">
            <Button variant="outline" className="mr-2">
              Буцах
            </Button>
          </Link>
          <Link href={`/job-descriptions/${data.id}/edit`}>
            <Button variant="secondary" className="ml-2">
              Засварлах
            </Button>
          </Link>
        </div>
      </div>
      <Card className="border-2 border-border bg-card p-8 shadow-lg md:p-12">
        {/* Document Header */}
        <div className="mb-4 text-center">
          <h1 className="mb-2 font-serif text-3xl font-bold text-foreground md:text-4xl">
            АЖЛЫН БАЙРНЫ ТОДОРХОЙЛОЛТ
          </h1>
          <div className="mt-4 flex flex-col gap-1 text-lg md:flex-row md:justify-center md:gap-6">
            <div>
              <span>Код:</span> {data.code}
            </div>
            <div>
              <span>Албан тушаал:</span>{" "}
              {data.job_position?.name || data.job_position_id}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Basic Information */}
        <Section title="I. Үндсэн мэдээлэл">
          <InfoRow
            label="Шууд удирдлагын албан тушаал"
            value={data.supervisor?.name || data.supervisor_pos_id}
          />
          <InfoRow
            label="Шууд захирагдах албан тушаал"
            value={data.subordinate?.name || data.subordinate_pos_id}
          />
          <InfoRow label="Харилцах хүрээ" value={data.communication_scope} />
        </Section>

        {/* Detailed Information */}
        <Section title="II. Дэлгэрэнгүй мэдээлэл">
          <InfoRow label="Зорилго" value={data.purpose} />
          <InfoRow label="Ажлын хуваарь" value={data.schedule} />
          <InfoRow label="Өдрийн ажлын цаг" value={data.daily_hours} />
          <InfoRow label="Завсарлагааны цаг" value={data.break_time} />
        </Section>

        {/* Duties and Responsibilities */}
        <Section title="III. Үүрэг хариуцлага">
          <List items={data.duties} />
        </Section>

        {/* Requirements */}
        <Section title="IV. Шаардлага">
          <div className="space-y-4">
            <InfoRow label="Боловсролын түвшин" value={data.education_level} />
            <InfoRow label="Ажлын туршлага" value={data.work_experience} />

            {data.general_skills && data.general_skills.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-foreground">
                  Ерөнхий ур чадвар:
                </p>
                <List items={data.general_skills} />
              </div>
            )}

            {data.professional_skills &&
              data.professional_skills.length > 0 && (
                <div>
                  <p className="mb-2 font-medium text-foreground">
                    Мэргэжлийн ур чадвар:
                  </p>
                  <List items={data.professional_skills} />
                </div>
              )}

            {data.additional_courses && data.additional_courses.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-foreground">
                  Нэмэлт сургалт:
                </p>
                <List items={data.additional_courses} />
              </div>
            )}
          </div>
        </Section>

        {/* Resources */}
        {data.resources && (
          <Section title="V. Нөөц, хэрэгсэл">
            <p className="text-foreground">{data.resources}</p>
          </Section>
        )}

        {/* Authority */}
        {data.authority && data.authority.length > 0 && (
          <Section title="VI. Эрх мэдэл">
            <List items={data.authority} />
          </Section>
        )}

        {/* Responsibilities */}
        {data.responsibilities && data.responsibilities.length > 0 && (
          <Section title="VII. Хариуцлага">
            <List items={data.responsibilities} />
          </Section>
        )}

        {/* Property Liability */}
        {data.property_liability && data.property_liability.length > 0 && (
          <Section title="VIII. Эд хөрөнгийн хариуцлага">
            <List items={data.property_liability} />
          </Section>
        )}

        {/* Relevant Laws */}
        {data.relevant_laws && data.relevant_laws.length > 0 && (
          <Section title="IX. Холбогдох хууль эрх зүй">
            <List items={data.relevant_laws} />
          </Section>
        )}

        {/* Note */}
        {data.note && (
          <Section title="X. Тэмдэглэл">
            <p className="italic text-muted-foreground">{data.note}</p>
          </Section>
        )}

        {/* <Separator className="my-8" /> */}

        {/* Signature Section */}
        {/* <div className="mt-8 grid gap-8 md:grid-cols-2">
          <SignatureBlock title="Боловсруулсан" />
          <SignatureBlock title="Батлав" />
        </div> */}
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
    <div className="mb-6">
      <h2 className="mb-3 font-serif text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="pl-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <div className="mb-3 flex flex-col gap-1 md:flex-row md:gap-2">
      <span className="font-medium text-foreground md:min-w-[200px]">
        {label}:
      </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-foreground">
          <span className="text-muted-foreground">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SignatureBlock({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <p className="font-medium text-foreground">{title}:</p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <span className="text-muted-foreground">Нэр:</span>
          <div className="flex-1 border-b border-border" />
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground">Гарын үсэг:</span>
          <div className="flex-1 border-b border-border" />
        </div>
        <div className="flex gap-2">
          <span className="text-muted-foreground">Огноо:</span>
          <div className="flex-1 border-b border-border" />
        </div>
      </div>
    </div>
  );
}
