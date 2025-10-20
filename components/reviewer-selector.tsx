import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/utils/supabase/client";
import { getStepRoleId, StepType } from "@/utils/workflow";

interface Profile {
  id: string;
  name: string;
  phone: string;
  department_name: string;
}

interface Reviewer {
  profile_id: string;
  profile: Profile;
}

// Supabase-аас ирж буй өгөгдлийн төрөл
interface DatabaseReviewer {
  profile_id: string;
  profile: Profile | Profile[];
}

interface TechnicalReviewerSelectorProps {
  selectedReviewers: string[];
  onReviewersChange: (userIds: string[]) => void;
  minimumSelection?: number;
  currentStep: StepType;
  maxSelection?: number;
}

export function TechnicalReviewerSelector({
  selectedReviewers,
  onReviewersChange,
  minimumSelection = 2,
  maxSelection,
  currentStep,
}: TechnicalReviewerSelectorProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const role_id = getStepRoleId(currentStep);

  useEffect(() => {
    const fetchReviewers = async () => {
      try {
        const supabase = createClient();

        const { data: reviewers, error } = await supabase
          .from("roles_profiles")
          .select(
            `
            profile_id,
            profile:profile_id (
              id,
              name,
              phone,
              department_name
            )
          `
          )
          .eq("role_id", role_id)
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching reviewers:", error);
          throw new Error(error.message);
        }

        // any төрлийг DatabaseReviewer төрлөөр солих
        setReviewers(
          (reviewers || []).map((r: DatabaseReviewer) => ({
            profile_id: r.profile_id,
            profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
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
  }, [role_id]); // role_id-г dependency-д нэмэх

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
                key={reviewer.profile_id}
                className="flex items-center space-x-3">
                <Checkbox
                  id={`reviewer-${reviewer.profile_id}`}
                  checked={selectedReviewers.includes(reviewer.profile_id)}
                  onCheckedChange={() =>
                    handleReviewerToggle(reviewer.profile_id)
                  }
                  disabled={
                    // Хэрэглэгч сонгоогүй, мөн дээд хязгаар тогтоосон бол ирэх үед л disable хийх
                    !selectedReviewers.includes(reviewer.profile_id) &&
                    maxSelection !== undefined &&
                    selectedReviewers.length >= maxSelection
                  }
                />
                <Label
                  htmlFor={`reviewer-${reviewer.profile_id}`}
                  className="flex-1 cursor-pointer">
                  <div className="font-medium">{reviewer.profile.name}</div>
                  <div className="text-sm text-gray-600">
                    {reviewer.profile.department_name} •{" "}
                    {reviewer.profile.phone}
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
                .filter((r) => selectedReviewers.includes(r.profile_id))
                .map((reviewer) => (
                  <li key={reviewer.profile_id}>
                    • {reviewer.profile.name} (
                    {reviewer.profile.department_name})
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
