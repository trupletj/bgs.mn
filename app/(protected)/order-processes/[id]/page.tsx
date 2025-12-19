import { getOrderProcess } from "@/actions/order-process";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Edit, Calendar, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OrderProcessDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OrderProcessDetailPage({
  params,
}: OrderProcessDetailPageProps) {
  const { id } = await params;
  const process = await getOrderProcess(Number(id));

  if (!process) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button variant="ghost" asChild className="pl-0">
          <Link href="/order-processes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Буцах
          </Link>
        </Button>
        <div className="flex justify-between items-center mt-4">
          <div>
            <h1 className="text-3xl font-bold">{process.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center text-muted-foreground">
                <Calendar className="mr-2 h-4 w-4" />
                {new Date(process.created_at).toLocaleDateString("mn-MN")}
              </div>
              <Badge variant={process.is_deleted ? "destructive" : "secondary"}>
                {process.is_deleted ? "Устгагдсан" : "Идэвхтэй"}
              </Badge>
            </div>
          </div>
          <Button asChild>
            <Link href={`/order-processes/${process.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Засах
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center mb-4">
          <List className="mr-2 h-5 w-5" />
          <h2 className="text-xl font-semibold">Үе шатууд</h2>
          <Badge variant="outline" className="ml-2">
            {process.steps.length} алхам
          </Badge>
        </div>

        <div className="space-y-4">
          {process.steps.map((step, index) => (
            <div
              key={step.id}
              className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      Алхам {index + 1}: {step.step_name}
                    </span>
                    {/* <Badge variant="secondary">#{step.step_order}</Badge> */}
                  </div>
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground">
                      Шаардлагатай roles:
                    </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {step.roles.map((role) => (
                        <Badge key={role.id} variant="outline">
                          {role.display_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
