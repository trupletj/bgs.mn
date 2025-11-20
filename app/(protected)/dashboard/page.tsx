import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Briefcase, ClipboardList, User2 } from "lucide-react";
import { hasRole } from "@/actions/rbac";

export default async function Page() {
  // Системүүдийн жагсаалтыг ролуудтай нь хамт тодорхойлох
  const systems = [
    {
      title: "Журам, үнэлгээ",
      description: "Бодлого, журмын систем",
      href: "/policy",
      icon: FileText,
      requiredRoles: ["monitoring_emp", "super_admin"],
    },
    {
      title: "Захилга",
      description: "Захиалгын систем",
      href: "/orders",
      icon: ClipboardList,
      requiredRoles: ["hr_emp", "monitoring_emp", "super_admin"], // Бүх хүнд харагдана
    },
    {
      title: "Ажлын байрны тодорхойлолт",
      description: "Ажлын байрны тодорхойлолт",
      href: "/dashboard/job-descriptions",
      icon: Briefcase,
      requiredRoles: ["hr_emp", "super_admin"],
    },
    {
      title: "Админ",
      description: "Эрхийн тохиргоо",
      href: "/admin",
      icon: User2,
      requiredRoles: ["super_admin"],
    },
  ];

  // Хэрэглэгчид хандах эрхтэй системүүдийг шүүх
  const accessibleSystems = [];

  for (const system of systems) {
    const hasAccess = await hasRole(system.requiredRoles);
    if (hasAccess) {
      accessibleSystems.push(system);
    }
  }

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
          <div className="grid gap-6 md:grid-cols-3 justify-center">
            {accessibleSystems.map((system) => {
              const Icon = system.icon;
              return (
                <Link key={system.href} href={system.href} className="group">
                  <Card className="h-full transition-all hover:shadow-lg hover:border-primary">
                    <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                      <div className="mb-4 rounded-full bg-primary/10 p-6 transition-colors group-hover:bg-primary/20">
                        <Icon className="h-12 w-12 text-primary" />
                      </div>
                      <h2 className="mb-2 text-2xl font-semibold">
                        {system.title}
                      </h2>
                      <p className="text-muted-foreground">
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
