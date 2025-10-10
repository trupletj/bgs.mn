// app/dashboard/review-requests/page.tsx
import { Suspense } from "react";
import { ReviewRequestsList } from "@/components/review-requests-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReviewRequestsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Хяналтад орох хүсэлтүүд</h1>
        <p className="text-gray-600 mt-2">
          Таны хянагдахаар ирсэн хүсэлтүүдийн жагсаалт
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Хянагдахаар хүлээгдэж буй захиалгууд</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ReviewRequestsSkeleton />}>
            <ReviewRequestsList />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRequestsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 border rounded-lg"
        >
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      ))}
    </div>
  );
}
