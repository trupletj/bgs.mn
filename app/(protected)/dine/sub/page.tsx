"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { QrCode, ChevronRight, Search } from "lucide-react";

export default function SubEmployeeManager() {
  const router = useRouter();
  const supabase = createClient();

  const [organizations, setOrganizations] = useState<any[]>([]);
  const [qrCounts, setQrCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Компаниудыг татах
      const { data: orgs } = await supabase
        .from("organization")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (!orgs) return;
      setOrganizations(orgs);

      // QR тоог татах
      const { data: counts } = await supabase
        .from("sub_employee_for_food")
        .select("org_id")
        .eq("is_active", true);

      if (counts) {
        const countMap: Record<string, number> = {};
        counts.forEach((row) => {
          countMap[row.org_id] = (countMap[row.org_id] || 0) + 1;
        });
        setQrCounts(countMap);
      }

      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredOrgs = useMemo(() => {
    if (!searchTerm.trim()) return organizations;
    return organizations.filter((org) =>
      org.name?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [organizations, searchTerm]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 w-full mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">
        Гэрээт ажилчдын удирдлага
      </h1>

      {/* Хайлт */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Байгууллага хайх..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Жагсаалт */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredOrgs.map((org) => (
          <button
            key={org.id}
            onClick={() => router.push(`/dine/sub/${org.id}`)}
            className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-left">
            <div>
              <p className="font-medium text-slate-800">{org.name}</p>
              <div className="flex items-center gap-1 mt-1">
                <QrCode className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">
                  {qrCounts[org.id] || 0} QR код үүссэн
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400" />
          </button>
        ))}

        {filteredOrgs.length === 0 && (
          <p className="text-center text-slate-500 py-8">Илэрц олдсонгүй</p>
        )}
      </div>
    </div>
  );
}
