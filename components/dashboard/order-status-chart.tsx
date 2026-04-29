"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { OrderStatusCount } from "@/actions/dashboard";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  created_step: "#6366f1",
  approved: "#10b981",
  changes_requested: "#8b5cf6",
  rejected: "#ef4444",
};

export function OrderStatusChart({ data }: { data: OrderStatusCount[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Захиалгын төлөв</CardTitle>
        <CardDescription>Төлөв тус бүрийн тархалт</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              formatter={(value: number) => [value, "Захиалга"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={STATUS_COLORS[entry.status] ?? "var(--primary)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
