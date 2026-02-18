"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { deleteOverride } from "@/actions/meal-override";

export function DeleteOverrideButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={async () => {
        if (!confirm("Устгахдаа итгэлтэй байна уу?")) return;
        setLoading(true);
        try {
          await deleteOverride(id);
          toast.success("Амжилттай устгагдлаа");
        } catch (e) {
          toast.error("Алдаа гарлаа");
        } finally {
          setLoading(false);
        }
      }}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
