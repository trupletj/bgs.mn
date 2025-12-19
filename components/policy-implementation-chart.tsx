"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PolicyImplementationStats } from "@/types/stats";

interface PolicyImplementationChartProps {
  data: PolicyImplementationStats[];
  onPolicyClick?: (policyId: string) => void;
}

const PolicyImplementationChart: React.FC<PolicyImplementationChartProps> = ({
  data,
  onPolicyClick,
}) => {
  const chartData = data.map((item) => ({
    name: item.policyName.substring(0, 20) + "...",
    fullName: item.policyName,
    Хэрэгжилт: parseFloat(item.implementationRate.toFixed(1)),
    "Дундаж оноо": parseFloat(item.averageScore.toFixed(1)),
    "Үнэлсэн заалт": item.ratedClauses,
    "Нийт заалт": item.totalClauses,
    policyId: item.policyId,
  }));

  const handleBarClick = (data: any) => {
    if (onPolicyClick && data.activePayload) {
      const policyId = data.activePayload[0]?.payload?.policyId;
      if (policyId) {
        onPolicyClick(policyId);
      }
    }
  };

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          onClick={handleBarClick}
          margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={70} />
          <YAxis />
          <Tooltip
            formatter={(value, name) => {
              if (name === "Хэрэгжилт") return [`${value}%`, name];
              return [value, name];
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return payload[0].payload.fullName;
              }
              return label;
            }}
          />
          <Legend />
          <Bar dataKey="Хэрэгжилт" fill="#8884d8" name="Хэрэгжилт (%)" />
          <Bar dataKey="Дундаж оноо" fill="#82ca9d" name="Дундаж оноо" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PolicyImplementationChart;
