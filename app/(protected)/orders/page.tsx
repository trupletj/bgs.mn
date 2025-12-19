// import Link from "next/link";
// import { Button } from "@/components/ui/button";
// import { PlusIcon } from "lucide-react";
// import { OrdersList } from "@/components/orders/OrdersList";
// import { getOrdersByUser } from "@/actions/orders";
// import { Separator } from "@/components/ui/separator";
// import { ReviewRequestsList } from "@/components/review-requests-list";
// import { getProfileIdFromAuthUserId } from "@/actions/review";

// export const dynamic = "force-dynamic";

// export default async function OrdersOrdersPage() {
//   const orders = await getOrdersByUser();
//   const profile_id = await getProfileIdFromAuthUserId();

//   return (
//     <div className="py-6 px-4">
//       <h1 className="text-3xl font-bold text-gray-900 text-center">
//         Сэлбэг захиалгууд
//       </h1>
//       <Separator className="my-2" />
//       <div className="container mx-auto py-3 px-2">
//         <div className="flex justify-between items-center mb-6">
//           <div>
//             <h2 className="text-2xl font-bold text-gray-900">
//               Таны илгээсэн захиалгууд
//             </h2>
//             <p className="text-gray-600 mt-2">
//               Та өөрийн илгээсэн захиалгуудаа доорх жагсаалтаас харах боломжтой.
//             </p>
//           </div>
//           <Link href="/orders/new">
//             <Button>
//               <PlusIcon className="h-4 w-4 mr-2" />
//               Захиалга үүсгэх
//             </Button>
//           </Link>
//         </div>

//         {!orders ? (
//           <div className="animate-pulse bg-gray-200 h-64 rounded-lg" />
//         ) : (
//           <OrdersList orders={orders.data ?? []} />
//         )}
//       </div>

//       <Separator className="my-2" />
//       <div className="py-3 px-2">
//         <div className="mb-2">
//           <h2 className="text-2xl font-bold text-gray-900">
//             Танд хянагдах захиалгууд
//           </h2>
//           <p className="text-gray-600 mt-2">
//             Та өөрийн хянах захиалгуудаа доорх жагсаалтаас харах боломжтой.
//           </p>
//         </div>
//         <ReviewRequestsList profile_id={profile_id} />
//       </div>
//     </div>
//   );
// }

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Briefcase, ClipboardList, User2 } from "lucide-react";
import { hasRole } from "@/actions/rbac";

export default async function OrdersPage() {
  // Системүүдийн жагсаалтыг ролуудтай нь хамт тодорхойлох
  const systems = [
    {
      title: "Захиалгын төрөл",
      description: "Захиалгын процессын төрлийн тохиргоо",
      href: "/order-processes",
      icon: FileText,
      requiredRoles: ["monitoring_emp", "super_admin"],
    },
    {
      title: "Захиалгын жагсаалт",
      description: "Захиалгын систем",
      href: "/orders/list",
      icon: ClipboardList,
      requiredRoles: ["hr_emp", "monitoring_emp", "super_admin"],
    },
    {
      title: "Захиалгын ерөнхий мэдээлэл",
      description: "Нэгдсэн захиалыгын мэдээлэл",
      href: "#",
      icon: Briefcase,
      requiredRoles: ["hr_emp", "super_admin"],
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
