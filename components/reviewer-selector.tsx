import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";

interface Reviewer {
  user_id: string;
  users: {
    id: string;
    nice_name: string;
    phone: string;
    department_name: string;
  };
}

interface TechnicalReviewerSelectorProps {
  selectedReviewers: string[];
  onReviewersChange: (userIds: string[]) => void;
  minimumSelection?: number;
  maxSelection?: number;
}

export function TechnicalReviewerSelector({
  selectedReviewers,
  onReviewersChange,
  minimumSelection = 2,
  maxSelection,
}: TechnicalReviewerSelectorProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const supabase = createClient();

        const { data: reviewers, error } = await supabase
          .from("user_roles")
          .select(
            `
            user_id,
            users:user_id (
              id,
              nice_name,
              phone,
              department_name
            )
          `
          )
          .eq("role_id", "9")
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching reviewers:", error);
          throw new Error(error.message);
        }

        console.log("Fetched reviewers:", reviewers);
        setReviewers(
          (reviewers || []).map((r: any) => ({
            user_id: r.user_id,
            users: Array.isArray(r.users) ? r.users[0] : r.users,
          }))
        );
      } catch (err) {
        console.error("Error in fetchReviewers:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchReviewers();
  }, []);

  const handleReviewerToggle = (userId: string) => {
    if (selectedReviewers.includes(userId)) {
      // Хэрэглэгчийг хасах (хасахгүй бол minimumSelection-аас бага болохгүй)
      if (selectedReviewers.length > minimumSelection) {
        onReviewersChange(selectedReviewers.filter((id) => id !== userId));
      }
    } else {
      // Хэрэглэгчийг нэмэх
      onReviewersChange([...selectedReviewers, userId]);
    }
  };

  const getBadgeText = () => {
    if (maxSelection) {
      return `${selectedReviewers.length} сонгогдсон (${minimumSelection}-${maxSelection} хүртэл)`;
    }
    return `${selectedReviewers.length} сонгогдсон (${minimumSelection} ба түүнээс дээш)`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Техник шалгуулагчид</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Техник шалгуулагчид</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 bg-red-50 p-4 rounded-md">
            Алдаа гарлаа: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Хянагчид</span>
          <Badge variant="outline">{getBadgeText()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {reviewers.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              Хянагч олдсонгүй
            </div>
          ) : (
            reviewers.map((reviewer) => (
              <div
                key={reviewer.user_id}
                className="flex items-center space-x-3"
              >
                <Checkbox
                  id={`reviewer-${reviewer.user_id}`}
                  checked={selectedReviewers.includes(reviewer.user_id)}
                  onCheckedChange={() => handleReviewerToggle(reviewer.user_id)}
                  disabled={
                    // Хэрэглэгч сонгоогүй, мөн дээд хязгаар тогтоосон бол ирэх үед л disable хийх
                    !selectedReviewers.includes(reviewer.user_id) &&
                    maxSelection !== undefined &&
                    selectedReviewers.length >= maxSelection
                  }
                />
                <Label
                  htmlFor={`reviewer-${reviewer.user_id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="font-medium">{reviewer.users.nice_name}</div>
                  <div className="text-sm text-gray-600">
                    {reviewer.users.department_name} • {reviewer.users.phone}
                  </div>
                </Label>
              </div>
            ))
          )}
        </div>

        {selectedReviewers.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h4 className="font-medium text-blue-800 mb-2">
              Сонгогдсон хянагчид:
            </h4>
            <ul className="text-sm text-blue-700">
              {reviewers
                .filter((r) => selectedReviewers.includes(r.user_id))
                .map((reviewer) => (
                  <li key={reviewer.user_id}>
                    • {reviewer.users.nice_name} (
                    {reviewer.users.department_name})
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          <p>• Хамгийн багадаа {minimumSelection} хүн сонгох шаардлагатай</p>
          {maxSelection && (
            <p>• Хамгийн ихдээ {maxSelection} хүн сонгож болно</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
