"use client";

import { useState } from "react";
import { Briefcase, Gavel, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import RatingDialogContent from "../rating/RatingDialogContent";
import type { RevisionMarker } from "@/actions/policy-legal-acts";

interface SingleClauseProps {
  clause: {
    id: string;
    reference_number: string;
    text: string;
    parent_id: string | null;
    policy_id: string;
  };
  isRating?: boolean;
  revisionMarkers?: RevisionMarker[];
  className?: string;
}

const SingleClause = ({
  clause,
  isRating,
  revisionMarkers = [],
  className,
}: SingleClauseProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const depth = (clause.reference_number.match(/\./g) ?? []).length;
  const indent = ["pl-0", "pl-6", "pl-12", "pl-18", "pl-24"][
    Math.min(depth, 4)
  ];

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40",
        indent,
        className,
      )}
    >
      <span className="mt-0.5 inline-flex shrink-0 items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
        {clause.reference_number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-foreground">{clause.text}</p>
        {revisionMarkers.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {revisionMarkers.map((marker) => (
              <Link
                key={`${marker.legal_act.id}-${marker.clause_id}`}
                href={`/policy/legal-acts/${marker.legal_act.id}`}
                className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Gavel className="h-3 w-3" />
                {marker.legal_act.act_number} тушаалаар шинэчлэгдсэн
              </Link>
            ))}
          </div>
        )}
      </div>

      {isRating && (
        <div className="flex shrink-0 items-center gap-2 opacity-60 transition-opacity group-hover:opacity-100">
          <Button asChild variant="outline" size="sm">
            <Link href={`/policy/${clause.policy_id}/${clause.id}`}>
              <Briefcase className="h-4 w-4" />
              Ажлын байр холбох
            </Link>
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Star className="h-4 w-4" />
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
  );
};

export default SingleClause;
