"use client";

import { toast } from "sonner";
import { Button } from "../ui/button";
// import { hasAccess } from "@/action/PermissionService"; // access check function

const DeletePolicyButton = ({
  policy_id,
  onDeleted,
  canDelete,
}: {
  policy_id: string;
  onDeleted?: () => void;
  canDelete?: boolean;
}) => {
  const handleDelete = async (policy_id: string) => {
    if (!canDelete) return null;
    if (!confirm("Журмыг устгахдаа итгэлтэй байна уу?")) return;
    try {
      const response = await fetch(`/api/policy?id=${policy_id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Устгахад алдаа гарлаа");

      toast.success("Журам амжилттай устгагдлаа");

      if (onDeleted) onDeleted();
    } catch (error) {
      console.error("Delete policy error:", error);
      toast.error(`Алдаа: ${(error as Error).message}`);
    }
  };

  return (
    <Button
      variant="destructive"
      size="sm"
      className="h-7"
      onClick={() => handleDelete(policy_id)}>
      Устгах
    </Button>
  );
};

export default DeletePolicyButton;
