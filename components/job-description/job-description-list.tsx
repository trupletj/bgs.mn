"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import JobDescSeeButton from "./job-desc-see-button";
// import JobDescDeleteButton from "./job-desc-delete-button";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { PlusIcon } from "lucide-react";

interface JobDescription {
  id: string;
  job_position: {
    name: string | null;
  }[]; // Allow array here
  a_code: string | null;
}

export default function JobDescriptionList() {
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetchJobDescriptions();
  }, [currentPage, debouncedSearchTerm]);

  const fetchJobDescriptions = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      // Query-г засах - name-ийн оронд байгаа column-уудыг ашиглах
      let query = supabase
        .from("job_description")
        .select("id, job_position:job_position_id(name), a_code", {
          count: "exact",
        })
        .eq("is_deleted", false)
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
        .order("id", { ascending: false }); // created_at эсвэл өөр column

      // Хайлтыг title эсвэл a_code дээр хийх
      if (debouncedSearchTerm) {
        query = query.or(
          `title.ilike.%${debouncedSearchTerm}%,a_code.ilike.%${debouncedSearchTerm}%`
        );
      }

      const { data: jobDescriptionsData, error, count } = await query;

      if (error) throw error;

      setJobDescriptions(jobDescriptionsData || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));
    } catch (error) {
      console.error("Fetch jobDescriptions error:", error);
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getJobPositionName = (jobPosition: any[] | null): string => {
    if (
      !jobPosition ||
      (Array.isArray(jobPosition) && jobPosition.length === 0)
    ) {
      return "Ажлын байргүй";
    }
    const positions = Array.isArray(jobPosition) ? jobPosition : [jobPosition];
    return positions
      .map((p) => p.name || "")
      .filter(Boolean)
      .join(", ");
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <Link
        href="/job-descriptions/new"
        className="flex cursor-pointer justify-end mb-2">
        <Button className="items-center flex">
          <PlusIcon className="h-4 w-4 " />
          Нэмэх
        </Button>
      </Link>
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Ажлын байрны тодорхойлолтууд</h2>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Код эсвэл нэрээр хайх..."
            className="border px-4 py-2 rounded-md pl-10 min-w-[600px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg
            className="absolute left-3 top-3 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      {isLoading ? (
        <div className="text-center py-8">Ачаалж байна...</div>
      ) : jobDescriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Бүртгэлтэй ажлын байрны тодорхойлолт олдсонгүй
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[30px]">
                    Код
                  </TableHead>
                  {/* <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[200px]">
                    Гарчиг
                  </TableHead> */}
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[200px]">
                    Ажлын байр
                  </TableHead>
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[150px]">
                    Үйлдэл
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobDescriptions.map((job_description) => (
                  <TableRow key={job_description.id}>
                    <TableCell className="px-4 py-2 text-center">
                      {job_description.a_code || "Кодгүй"}
                    </TableCell>
                    {/* <TableCell className="px-4 py-2">
                      <div
                        className="break-words whitespace-normal"
                        title={job_description.title || "Гарчиггүй"}>
                        {job_description.title || "Гарчиггүй"}
                      </div>
                    </TableCell> */}
                    <TableCell className="px-4 py-2">
                      <div
                        className="break-words whitespace-normal"
                        title={getJobPositionName(
                          job_description.job_position
                        )}>
                        {getJobPositionName(job_description.job_position)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex gap-2 justify-center items-center">
                        <JobDescSeeButton
                          job_description_id={job_description.id}
                        />
                        {/* <JobDescDeleteButton
                          job_description_id={job_description.id}
                          onDeleted={fetchJobDescriptions}
                        /> */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!isLoading && jobDescriptions.length > 0 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                Нийт {totalPages} хуудасны {currentPage}-р хуудас
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(1);
                    window.scrollTo(0, 0);
                  }}>
                  Эхний хуудас
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage((prev) => prev - 1);
                    window.scrollTo(0, 0);
                  }}>
                  Өмнөх
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage((prev) => prev + 1);
                    window.scrollTo(0, 0);
                  }}>
                  Дараагийн
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage(totalPages);
                    window.scrollTo(0, 0);
                  }}>
                  Сүүлийн хуудас
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
