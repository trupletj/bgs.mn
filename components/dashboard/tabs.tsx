"use client";

import { useState } from "react";
import { LayoutDashboard, Clock } from "lucide-react";
import AttendanceEmbed from "@/components/attendance-embed";
import { cn } from "@/lib/utils";

export function DashboardTabs({
  dashboardContent,
}: {
  dashboardContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "attendance">(
    "dashboard",
  );

  return (
    // Өндрийг viewport-оор нь хязгаарлана (header + хуудасны p-4/lg:p-6
    // padding-г хассан) — ингэснээр гаднах хуудас (document) scroll хийхгүй,
    // идэвхтэй tab-ийн дотор л (attendance үед зөвхөн iframe өөрөө) scroll хийнэ.
    <div className="flex h-[calc(100dvh-var(--header-height,48px)-3rem)] flex-col gap-6">
      <div className="inline-flex w-fit shrink-0 items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
        <TabButton
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          icon={LayoutDashboard}
          label="Хяналтын самбар"
        />
        <TabButton
          active={activeTab === "attendance"}
          onClick={() => setActiveTab("attendance")}
          icon={Clock}
          label="Цаг бүртгэл / Ээлж"
        />
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          activeTab === "dashboard" ? "block" : "hidden",
        )}>
        {dashboardContent}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          // mobile: sidebar/header-ийн доор шууд дэлгэцийн доод ирмэгт хүчээр
          // зоож байрлуулна (position: fixed) — attendance апп-ын доод
          // footbar нь browser-ийн хаяг мөрийн өндөр хэлбэлзэл, 100dvh
          // тооцооллын зөрөөнөөс үл хамааран үргэлж бодит дэлгэцийн ирмэгт
          // харагдана. Desktop дээр өмнөх шиг flex-1-ээр л оршино.
          "max-md:fixed max-md:inset-x-0 max-md:top-(--header-height) max-md:bottom-0 max-md:z-40",
          activeTab === "attendance" ? "block" : "hidden",
        )}>
        <AttendanceEmbed fill />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground",
      )}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
