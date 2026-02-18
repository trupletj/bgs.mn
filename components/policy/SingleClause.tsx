"use client";
import { Link as IconLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Clause } from "@/types/types";
import RatingDialogContent from "../rating/RatingDialogContent";
import { useState } from "react";

// import RatingDialogContent from "./rating-dialog-content";
// import { hasAccess } from "@/action/PermissionService";

interface SingleClauseProps {
  clause: Clause;
  isRating?: boolean;
}

const SingleClause = ({ clause, isRating }: SingleClauseProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="ml-2 flex gap-5 items-baseline">
      <div className="shrink-0 font-light pt-1">{clause.reference_number}</div>

      <div className="flex-1 flex items-center justify-between gap-2">
        <div className="text-m">{clause.text}</div>

        {isRating && (
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/policy/${clause.policy_id}/${clause.id}`}>
              <IconLink className="w-4 h-4 cursor-pointer hover:scale-110" />
            </Link>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-xs px-3 py-1 h-auto cursor-pointer">
                  Үнэлэх
                </Button>
              </DialogTrigger>
              <RatingDialogContent
                id={clause.id}
                clause_reference_code={clause.reference_number}
                clause_text={clause.text}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
              />
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleClause;
