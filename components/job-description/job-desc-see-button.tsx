import Link from "next/link";
import { Eye } from "lucide-react";

const SeePolicyButton = ({
  job_description_id,
}: {
  job_description_id: string;
}) => {
  return (
    <Link
      href={`/job-descriptions/${job_description_id}`}
      className="cursor-pointer"
      title="Албан тушаалын тодорхойлолт унших">
      <Eye className=" hover:scale-110 h-6" />
    </Link>
  );
};

export default SeePolicyButton;
