// app/dashboard/policy-analytics/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PolicyImplementationStats, JobPositionStats } from "@/types/stats";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PolicyImplementationChart from "@/components/policy-implementation-chart";
import ActionTypeDistributionChart from "@/components/action-type-distribution";
import {
  getPolicyImplementationStats,
  getJobPositionStats,
  getHighRiskRatings,
  getOverallStatistics,
} from "@/actions/stat";

const actionTypeLabels = {
  IMPLEMENTATION: "Хэрэгжүүлэлт",
  MONITORING: "Хяналт",
  VERIFICATION: "Баталгаажуулалт",
  DEPLOYMENT: "Нэвтрүүлэлт",
};

export default function PolicyAnalyticsPage() {
  const [policyStats, setPolicyStats] = useState<PolicyImplementationStats[]>(
    []
  );
  const [jobPositionStats, setJobPositionStats] = useState<JobPositionStats[]>(
    []
  );
  const [highRiskRatings, setHighRiskRatings] = useState<any[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalPolicies: 0,
    totalJobPositions: 0,
    totalRatings: 0,
    averageScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedJobPosition, setSelectedJobPosition] = useState<string | null>(
    null
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [policyData, jobData, riskData, overallData] = await Promise.all([
        getPolicyImplementationStats(),
        getJobPositionStats(),
        getHighRiskRatings(),
        getOverallStatistics(),
      ]);

      setPolicyStats(policyData);
      setJobPositionStats(jobData);
      setHighRiskRatings(riskData);
      setOverallStats(overallData);
    } catch (error) {
      console.error("Өгөгдөл татахад алдаа гарлаа:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePolicyClick = (policyId: string) => {
    // Тухайн журмын дэлгэрэнгүй харах
    console.log("Selected policy:", policyId);
    // Энд та policyId-г ашиглан дэлгэрэнгүй хуудас руу шилжих эсвэл modal дэлгэх
    // router.push(`/dashboard/policy-analytics/${policyId}`);
  };

  const handleJobPositionSelect = (jobPositionId: string) => {
    setSelectedJobPosition(
      selectedJobPosition === jobPositionId ? null : jobPositionId
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 3.5) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 3) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    if (score >= 2) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4.5) return "Маш сайн";
    if (score >= 3.5) return "Сайн";
    if (score >= 3) return "Дундаж";
    if (score >= 2) return "Дундаж доош";
    return "Муу";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-gray-600">Өгөгдөл уншиж байна...</p>
      </div>
    );
  }

  const totalImplementationRate =
    policyStats.length > 0
      ? policyStats.reduce((sum, item) => sum + item.implementationRate, 0) /
        policyStats.length
      : 0;

  const averageImplementationRate = parseFloat(
    totalImplementationRate.toFixed(1)
  );

  // Хамгийн муу хэрэгжилттэй 3 ажлын байр
  const worstPerformingJobs = [...jobPositionStats]
    .filter((job) => job.totalClauses > 0)
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 3);

  // Хамгийн сайн хэрэгжилттэй 3 ажлын байр
  const bestPerformingJobs = [...jobPositionStats]
    .filter((job) => job.totalClauses > 0)
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3);

  const selectedJob = selectedJobPosition
    ? jobPositionStats.find((j) => j.jobPositionId === selectedJobPosition)
    : undefined;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Нүүр картнууд */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">
              Нийт журмууд
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800">
              {overallStats.totalPolicies}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {policyStats.length} үнэлгээтэй журмууд
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">
              Хэрэгжилтийн хувь
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-800">
              {averageImplementationRate}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${averageImplementationRate}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">
              Ажлын байр
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-800">
              {overallStats.totalJobPositions}
            </div>
            <p className="text-xs text-purple-600 mt-1">
              {jobPositionStats.length} холбогдсон байр
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Эрсдэлтэй үнэлгээ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-800">
              {highRiskRatings.length}
            </div>
            <p className="text-xs text-red-600 mt-1">6 оноотой үнэлгээ</p>
          </CardContent>
        </Card>
      </div>

      {/* График болон статистик */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Журмын хэрэгжилтийн график */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Журмын хэрэгжилтийн үнэлгээ</CardTitle>
              <Badge variant="outline" className="ml-2">
                Нийт: {policyStats.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <PolicyImplementationChart
                data={policyStats}
                onPolicyClick={handlePolicyClick}
              />
            </div>
          </CardContent>
        </Card>

        {/* Дундаж үзүүлэлтүүд */}
        <Card>
          <CardHeader>
            <CardTitle>Ерөнхий үзүүлэлтүүд</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Нийт үнэлгээ</p>
              <p className="text-2xl font-bold">{overallStats.totalRatings}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Дундаж оноо</p>
              <p className="text-2xl font-bold">{overallStats.averageScore}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className={`h-2 rounded-full ${
                    getScoreColor(overallStats.averageScore).split(" ")[0]
                  }`}
                  style={{
                    width: `${(overallStats.averageScore / 5) * 100}%`,
                  }}></div>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Шилдэг ажлын байр</p>
              <div className="space-y-2">
                {bestPerformingJobs.map((job) => (
                  <div
                    key={job.jobPositionId}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleJobPositionSelect(job.jobPositionId)}>
                    <span className="text-sm truncate">
                      {job.jobPositionName}
                    </span>
                    <Badge className={getScoreColor(job.averageScore)}>
                      {job.averageScore.toFixed(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">
                Сайжруулах шаардлагатай
              </p>
              <div className="space-y-2">
                {worstPerformingJobs.map((job) => (
                  <div
                    key={job.jobPositionId}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => handleJobPositionSelect(job.jobPositionId)}>
                    <span className="text-sm truncate">
                      {job.jobPositionName}
                    </span>
                    <Badge className={getScoreColor(job.averageScore)}>
                      {job.averageScore.toFixed(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ажлын байрын мэдээлэл */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ажлын байрын жагсаалт */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Ажлын байрын хуваарилалт</CardTitle>
              <Badge variant="outline">Нийт: {jobPositionStats.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Ажлын байр</TableHead>
                      <TableHead className="text-center">Заалт</TableHead>
                      <TableHead className="text-center">Дундаж</TableHead>
                      <TableHead className="text-center">Төрөл</TableHead>
                      <TableHead className="text-center">Үнэлгээ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobPositionStats.slice(0, 10).map((job) => (
                      <TableRow
                        key={job.jobPositionId}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          selectedJobPosition === job.jobPositionId
                            ? "bg-blue-50"
                            : ""
                        }`}
                        onClick={() =>
                          handleJobPositionSelect(job.jobPositionId)
                        }>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                              <span className="text-xs font-bold text-blue-800">
                                {job.jobPositionName.charAt(0)}
                              </span>
                            </div>
                            <span className="truncate">
                              {job.jobPositionName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{job.totalClauses}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <Badge className={getScoreColor(job.averageScore)}>
                              {job.averageScore.toFixed(1)}
                            </Badge>
                            <span className="text-xs text-gray-500 mt-1">
                              {getScoreLabel(job.averageScore)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {job.implementationClauses > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-blue-50">
                                Х: {job.implementationClauses}
                              </Badge>
                            )}
                            {job.monitoringClauses > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-50">
                                Хя: {job.monitoringClauses}
                              </Badge>
                            )}
                            {job.verificationClauses > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-50">
                                Б: {job.verificationClauses}
                              </Badge>
                            )}
                            {job.deploymentClauses > 0 && (
                              <Badge
                                variant="outline"
                                className="text-xs bg-purple-50">
                                Н: {job.deploymentClauses}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="w-16 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                            <div
                              className={`h-full ${
                                getScoreColor(job.averageScore).split(" ")[0]
                              }`}
                              style={{
                                width: `${(job.averageScore / 5) * 100}%`,
                              }}></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {jobPositionStats.length > 10 && (
                <div className="text-center pt-2">
                  <p className="text-sm text-gray-500">
                    + {jobPositionStats.length - 10} ажлын байр
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Сонгогдсон ажлын байрын график */}
        {selectedJobPosition && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{selectedJob?.jobPositionName || ""}</CardTitle>
                <Badge
                  className={getScoreColor(selectedJob?.averageScore ?? 0)}>
                  Дундаж: {(selectedJob?.averageScore ?? 0).toFixed(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ActionTypeDistributionChart data={selectedJob!} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Үндсэн мэдээлэл
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-gray-500">Нийт заалт: </span>
                      <span className="font-medium">
                        {selectedJob?.totalClauses ?? 0}
                      </span>
                    </p>
                    <p className="text-sm">
                      <span className="text-gray-500">Үнэлгээний тоо: </span>
                      <span className="font-medium">
                        {
                          Object.values(selectedJob?.scoresByType || {}).flat()
                            .length
                        }
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Заалтын төрөл
                  </p>
                  <div className="space-y-1">
                    {(selectedJob?.implementationClauses ?? 0) > 0 && (
                      <p className="text-sm">
                        <span className="text-gray-500">Хэрэгжүүлэлт: </span>
                        <span className="font-medium text-blue-600">
                          {selectedJob?.implementationClauses ?? 0}
                        </span>
                      </p>
                    )}
                    {(selectedJob?.monitoringClauses ?? 0) > 0 && (
                      <p className="text-sm">
                        <span className="text-gray-500">Хяналт: </span>
                        <span className="font-medium text-green-600">
                          {selectedJob?.monitoringClauses ?? 0}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Эрсдэлтэй үнэлгээний жагсаалт */}
      {highRiskRatings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-red-700">
                Анхаарах шаардлагатай үнэлгээнүүд
              </CardTitle>
              <Badge variant="destructive">
                {highRiskRatings.length} эрсдэлтэй
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50">
                    <TableHead className="text-red-700">Журам</TableHead>
                    <TableHead className="text-red-700">Заалт</TableHead>
                    <TableHead className="text-red-700">Ажлын байр</TableHead>
                    <TableHead className="text-red-700">Төрөл</TableHead>
                    <TableHead className="text-red-700">Тайлбар</TableHead>
                    <TableHead className="text-red-700">Огноо</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highRiskRatings.map((rating) => {
                    const typeKey = rating.clause_job_position?.type as
                      | keyof typeof actionTypeLabels
                      | undefined;
                    return (
                      <TableRow key={rating.id} className="hover:bg-red-50">
                        <TableCell className="font-medium">
                          {rating.clause_job_position?.clause?.policy?.name ||
                            "Тодорхойгүй"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-red-300">
                            {rating.clause_job_position?.clause
                              ?.reference_number || "Тодорхойгүй"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center mr-2">
                              <span className="text-xs font-bold text-red-800">
                                {rating.clause_job_position?.job_position?.name?.charAt(
                                  0
                                ) || "?"}
                              </span>
                            </div>
                            {rating.clause_job_position?.job_position?.name ||
                              "Тодорхойгүй"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {typeKey && actionTypeLabels[typeKey]
                            ? actionTypeLabels[typeKey]
                            : rating.clause_job_position?.type || "Тодорхойгүй"}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="group relative">
                            <div className="truncate">
                              {rating.description || "Тайлбар байхгүй"}
                            </div>
                            {rating.description &&
                              rating.description.length > 50 && (
                                <div className="absolute z-10 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                                  {rating.description}
                                </div>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {new Date(rating.scored_date).toLocaleDateString(
                              "mn-MN"
                            )}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Анхааруулга:</span> 6 оноо нь
                асуудалтай, засахад шаардлагатай заалтыг илэрхийлнэ. Эдгээр
                үнэлгээг шуурхай шийдвэрлэх шаардлагатай.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Хуудасны төгсгөлд refresh товч */}
      <div className="flex justify-center">
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Уншиж байна...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Өгөгдөл шинэчлэх
            </>
          )}
        </button>
      </div>
    </div>
  );
}
