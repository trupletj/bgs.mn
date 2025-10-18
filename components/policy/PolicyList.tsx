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
import PolicySeeButton from "./PolicySeeButton";
import DeletePolicyButton from "./PolicyDeleteButton";
import { createClient } from "@/utils/supabase/client";

interface Policy {
  id: string;
  name: string | null;
  approved_date: string | null;
  reference_code: string | null;
}

export default function PolicyList() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    fetchPolicies();
  }, [currentPage, debouncedSearchTerm]);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const {
        data: policyData,
        error,
        count,
      } = await supabase
        .from("policy")
        .select("id, name, approved_date, reference_code", { count: "exact" })
        .ilike("name", `%${debouncedSearchTerm}%`)
        .eq("is_deleted", false)
        .range((currentPage - 1) * pageSize, currentPage * pageSize - 1)
        .order("approved_date", { ascending: false });

      if (error) throw error;

      setPolicies(policyData || []);
      setTotalPages(Math.ceil(count! / pageSize));
    } catch (error) {
      console.error("Fetch policies error:", error);
      toast.error(`Алдаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="flex justify-between mb-6">
        <h2 className="text-2xl font-bold">Журмууд</h2>
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
      ) : policies.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Журам олдсонгүй</div>
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
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[120px]">
                    Баталсан огноо
                  </TableHead>
                  <TableHead className="text-center font-bold bg-gray-100 dark:bg-gray-700 px-4 py-3 min-w-[150px]">
                    Үйлдэл
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="px-4 py-2">
                      {policy.reference_code}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div
                        className="break-words whitespace-normal"
                        title={policy.name || ""}>
                        {policy.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2 text-center">
                      {policy.approved_date
                        ? new Date(policy.approved_date).toLocaleDateString(
                            "mn-MN"
                          )
                        : "Огноогүй"}
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <div className="flex gap-2 justify-center items-center">
                        <PolicySeeButton policy_id={policy.id} />
                        <DeletePolicyButton
                          policy_id={policy.id}
                          onDeleted={fetchPolicies}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!isLoading && policies.length > 0 && (
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
