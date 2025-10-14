import Link from "next/link";
import { Eye } from "lucide-react";

const SeePolicyButton = ({ policy_id }: { policy_id: string }) => {
  return (
    <Link
      href={`/policy/${policy_id}`}
      className="cursor-pointer"
      title="Журам унших">
      <Eye className=" hover:scale-110 h-6" />
    </Link>
  );
};

export default SeePolicyButton;
