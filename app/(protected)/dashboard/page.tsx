import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  FileText,
  Briefcase,
  ClipboardList,
  User2,
  Users,
  CookingPot,
} from "lucide-react";
import { hasPermission } from "@/actions/rbac"; // hasRole биш hasPermission ашиглана

export default async function Page() {
  const systems = [
    {
      title: "Журам, үнэлгээ",
      description: "Бодлого, журмын систем",
      href: "/t-info",
      icon: FileText,
      permission: { module: "policy", action: "access" },
    },
    {
      title: "Захиалга",
      description: "Захиалгын систем",
      href: "/orders",
      icon: ClipboardList,
      permission: { module: "orders", action: "access" },
    },
    {
      title: "Ажлын байрны тодорхойлолт",
      description: "Ажлын байрны тодорхойлолт",
      href: "/dashboard/job-descriptions",
      icon: Briefcase,
      permission: { module: "job_description", action: "access" },
    },
    {
      title: "Админ",
      description: "Эрхийн тохиргоо",
      href: "/admin",
      icon: User2,
      permission: { module: "admin_panel", action: "access" },
    },
    {
      title: "Ажилчид",
      description: "Ажилчдын мэдээлэл",
      href: "/employees", // Таны засах гэж буй хуудас
      icon: Users,
      permission: { module: "employee", action: "read" },
    },
    {
      title: "Гал тогооны систем",
      description: "Гал тогооны систем",
      href: "/dine",
      icon: CookingPot,
      permission: { module: "dining", action: "access" },
    },
  ];

  // Promise.all ашиглан бүх эрхийг нэг зэрэг хурдан шалгах
  const systemAccessResults = await Promise.all(
    systems.map(async (system) => {
      const hasAccess = await hasPermission(
        system.permission.module,
        system.permission.action,
      );
      return hasAccess ? system : null;
    }),
  );

  const accessibleSystems = systemAccessResults.filter(
    (s): s is (typeof systems)[0] => s !== null,
  );

  return (
    <div className="flex mt-3 items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-bold tracking-tight">
            Систем сонгох
          </h1>
          <p className="text-lg text-muted-foreground">
            Та ашиглах системээ сонгоно уу
          </p>
        </div>

        {accessibleSystems.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-4 justify-center">
            {accessibleSystems.map((system) => {
              const Icon = system.icon;
              return (
                <Link key={system.href} href={system.href} className="group">
                  <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
                    <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="mb-4 rounded-full bg-primary/10 p-6 transition-colors group-hover:bg-primary/20">
                        <Icon className="h-12 w-12 text-primary" />
                      </div>
                      <h2 className="mb-2 text-xl font-semibold">
                        {system.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {system.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">
              Танд хандах эрхтэй систем байхгүй байна.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
