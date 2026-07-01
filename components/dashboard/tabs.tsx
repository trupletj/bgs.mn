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
    <div className="flex flex-col gap-6">
      <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
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

      <div className={cn(activeTab === "dashboard" ? "block" : "hidden")}>
        {dashboardContent}
      </div>
      <div className={cn(activeTab === "attendance" ? "block" : "hidden")}>
        <AttendanceEmbed />
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
