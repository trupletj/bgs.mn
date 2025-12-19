// components/ActionTypeDistributionChart.tsx
"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { JobPositionStats } from "@/types/stats";

interface ActionTypeDistributionChartProps {
  data: JobPositionStats;
}

const ActionTypeDistributionChart: React.FC<
  ActionTypeDistributionChartProps
> = ({ data }) => {
  const chartData = [
    {
      name: "Хэрэгжүүлэлт",
      value: data.implementationClauses,
      color: "#0088FE",
    },
    { name: "Хяналт", value: data.monitoringClauses, color: "#00C49F" },
    {
      name: "Баталгаажуулалт",
      value: data.verificationClauses,
      color: "#FFBB28",
    },
    { name: "Нэвтрүүлэлт", value: data.deploymentClauses, color: "#FF8042" },
  ];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ActionTypeDistributionChart;
