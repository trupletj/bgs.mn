"use client";

import { AlertTriangle, Bus, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttendanceDayCard } from "@/components/dashboard/attendance-day-card";
import { EeljMockSection } from "@/components/attendance/eelj-mock-section";
import type { AttendanceDay } from "@/types/attendance";

export function AttendanceMiniAppTabs({ days }: { days: AttendanceDay[] }) {
  return (
    <Tabs
      defaultValue="attendance"
      className="relative flex min-h-[calc(100vh-var(--header-height))] flex-col gap-0"
    >
      <div className="flex-1 overflow-y-auto pb-24">
        <TabsContent
          value="attendance"
          className="m-0 flex flex-col gap-6 p-4 lg:p-6"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Сүүлийн 14 хоног
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              Ирц
            </h1>
          </div>

          {days.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">
                Цаг бүртгэлийн мэдээлэл байхгүй
              </p>
              <p className="text-sm text-muted-foreground">
                Утасны дугаар нь intranet системд бүртгэлгүй эсвэл бүртгэл хоосон
                байна
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {days.map((day) => (
                <AttendanceDayCard key={day.dayDate} day={day} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="eelj" className="m-0 p-4 lg:p-6">
          <EeljMockSection />
        </TabsContent>
      </div>

      <TabsList className="sticky bottom-0 left-0 right-0 z-30 h-16 w-full rounded-none border-t border-border bg-background/95 p-0 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <TabsTrigger
          value="attendance"
          className="flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-none border-0 px-2 py-2 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          <Clock className="!size-5" />
          <span>Цаг бүртгэл</span>
        </TabsTrigger>
        <TabsTrigger
          value="eelj"
          className="flex h-full flex-1 flex-col items-center justify-center gap-1 rounded-none border-0 px-2 py-2 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          <Bus className="!size-5" />
          <span>Ээлж солилцоо</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
