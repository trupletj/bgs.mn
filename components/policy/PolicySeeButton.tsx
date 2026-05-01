import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function PolicySeeButton({ policy_id }: { policy_id: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/policy/${policy_id}`}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">Журам унших</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Журам унших</TooltipContent>
    </Tooltip>
  );
}
