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
  title: string | null;
  //   approved_date: string | null;
  code: string | null;
}

export default function JobDescriptionList() {
  const [jobDescriptions, setjobDescriptions] = useState<JobDescription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetchjobDescriptions();
  }, [currentPage, debouncedSearchTerm]);

  const fetchjobDescriptions = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: jobDescriptionsData,
        error,
        count,
      } = await supabase
        .from("job_description")
        .select("id, title, code", { count: "exact" })
        .ilike("title", `%${debouncedSearchTerm}%`)
        .eq("is_deleted", false)
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
        .order("title", { ascending: false });

      if (error) throw error;

      setjobDescriptions(jobDescriptionsData || []);
      setTotalPages(Math.ceil(count! / pageSize));
    } catch (error) {
      console.error("Fetch jobDescriptions error:", error);
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
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
            placeholder="Хайх..."
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
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[100px]">
                    Код
                  </TableHead>
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[200px]">
                    Нэр
                  </TableHead>
                  {/* <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[120px]">
                    Баталсан огноо
                  </TableHead> */}
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[150px]">
                    Үйлдэл
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobDescriptions.map((job_description) => (
                  <TableRow key={job_description.id}>
                    <TableCell className="px-4 py-2">
                      {job_description.code}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div
                        className="break-words whitespace-normal"
                        title={job_description.title || ""}>
                        {job_description.title}
                      </div>
                    </TableCell>
                    {/* <TableCell className="px-4 py-2 text-center">
                      {policy.approved_date
                        ? new Date(policy.approved_date).toLocaleDateString(
                            "mn-MN"
                          )
                        : "Огноогүй"}
                    </TableCell> */}
                    <TableCell className="px-4 py-2">
                      <div className="flex gap-2 justify-center items-center">
                        <JobDescSeeButton
                          job_description_id={job_description.id}
                        />
                        {/* <JobDescDeleteButton
                          policy_id={job_description.id}
                          onDeleted={fetchjobDescriptions}
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
                Нийт: {totalPages} --- {currentPage}-р хуудас
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
