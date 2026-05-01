"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { policyStatusVariant } from "@/lib/policy-utils";

export interface ChartDatum {
  name: string;
  value: number;
}

export function PolicyImplementationChart({ data }: { data: ChartDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Дүрсэлэх өгөгдөл байхгүй
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          angle={-35}
          textAnchor="end"
          height={90}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          interval={0}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          width={36}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
          formatter={(v) => [`${v}%`, "Хэрэгжилт"]}
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--popover-foreground))",
            fontSize: "12px",
          }}
          labelStyle={{
            color: "hsl(var(--popover-foreground))",
            fontWeight: 600,
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={policyStatusVariant(d.value).fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
