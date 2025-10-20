"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2Icon, ClockIcon, UsersIcon } from "lucide-react";
import { PositionSelector } from "../position-selector";
import {
  createJobDescription,
  deleteJobDescription,
  updateJobDescription,
} from "@/actions/job-descripition";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { CommunicationScopeSelector } from "./communication-scope";

interface JobDescriptionData {
  id?: string;
  job_position_id: string;
  a_code: string;
  at_code: string;
  supervisor_pos_id: string | string[]; // Олон утга
  subordinate_pos_id: string | string[]; // Олон утга
  job_condition: string;
  communication_scope: string;
  purpose: string;
  schedule: string;
  daily_hours: string;
  break_time: string;
  duties: string[];
  education_level: string;
  work_experience: string;
  general_skills: string[];
  professional_skills: string[];
  additional_courses: string[];
  resources: string;
  authority: string[];
  responsibilities: string[];
  property_liability: string[];
  relevant_laws: string[];
  note: string;
}

interface JobDescriptionFormProps {
  initialData?: JobDescriptionData;
  isEdit?: boolean;
}

export function JobDescriptionForm({
  initialData,
  isEdit = false,
}: JobDescriptionFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<JobDescriptionData>({
    job_position_id: "",
    a_code: "",
    at_code: "",
    supervisor_pos_id: "",
    subordinate_pos_id: "",
    job_condition: "",
    communication_scope: "",
    purpose: "",
    schedule: "",
    daily_hours: "",
    break_time: "",
    duties: [""],
    education_level: "",
    work_experience: "",
    general_skills: [""],
    professional_skills: [""],
    additional_courses: [""],
    resources: "",
    authority: [""],
    responsibilities: [""],
    property_liability: [""],
    note: "",
    relevant_laws: [""],
  });

  // Initial data-г form-д оруулах
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        job_position_id: initialData.job_position_id || "",
        a_code: initialData.a_code || "",
        at_code: initialData.at_code || "",
        supervisor_pos_id: initialData.supervisor_pos_id || "",
        subordinate_pos_id: initialData.subordinate_pos_id || "",
        job_condition: initialData.job_condition || "",
        communication_scope: initialData.communication_scope || "",
        purpose: initialData.purpose || "",
        schedule: initialData.schedule || "",
        daily_hours: initialData.daily_hours || "",
        break_time: initialData.break_time || "",
        duties: initialData.duties?.length > 0 ? initialData.duties : [""],
        education_level: initialData.education_level || "",
        work_experience: initialData.work_experience || "",
        general_skills:
          initialData.general_skills?.length > 0
            ? initialData.general_skills
            : [""],
        professional_skills:
          initialData.professional_skills?.length > 0
            ? initialData.professional_skills
            : [""],
        additional_courses:
          initialData.additional_courses?.length > 0
            ? initialData.additional_courses
            : [""],
        resources: initialData.resources || "",
        authority:
          initialData.authority?.length > 0 ? initialData.authority : [""],
        responsibilities:
          initialData.responsibilities?.length > 0
            ? initialData.responsibilities
            : [""],
        property_liability:
          initialData.property_liability?.length > 0
            ? initialData.property_liability
            : [""],
        relevant_laws:
          initialData.relevant_laws?.length > 0
            ? initialData.relevant_laws
            : [""],
        note: initialData.note || "",
      });
    }
  }, [initialData]);

  const addArrayItem = (field: keyof JobDescriptionData, value = "") => {
    const currentArray = formData[field] as string[];
    setFormData((prev) => ({
      ...prev,
      [field]: [...currentArray, value],
    }));
  };

  const updateArrayItem = (
    field: keyof JobDescriptionData,
    index: number,
    value: string
  ) => {
    const currentArray = formData[field] as string[];
    const newArray = [...currentArray];
    newArray[index] = value;
    setFormData((prev) => ({
      ...prev,
      [field]: newArray,
    }));
  };

  const removeArrayItem = (field: keyof JobDescriptionData, index: number) => {
    const currentArray = formData[field] as string[];
    setFormData((prev) => ({
      ...prev,
      [field]: currentArray.filter((_, i) => i !== index),
    }));
  };

  const handleJobPositionSelect = (jobPositionId: string | string[]) => {
    // Job position нь үргэлж ганц утга байх ёстой
    if (Array.isArray(jobPositionId)) {
      setFormData((prev) => ({
        ...prev,
        job_position_id: jobPositionId[0] || "", // Эхний утгыг авах
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        job_position_id: jobPositionId,
      }));
    }
  };

  const handleSupervisorSelect = (supervisorIds: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      supervisor_pos_id: supervisorIds,
    }));
  };

  const handleSubordinateSelect = (subordinateIds: string | string[]) => {
    setFormData((prev) => ({
      ...prev,
      subordinate_pos_id: subordinateIds,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Job Description Data:", formData);

      let result;
      if (isEdit && formData.id) {
        result = await updateJobDescription(formData.id, formData);
      } else {
        result = await createJobDescription(formData);
      }
      console.log("submission result:", result);
      console.log(JSON.stringify(result, null, 2));
      if (result.error) {
        toast.error(`Алдаа гарлаа: ${result.error.message}`);
        return;
      }

      toast.success(isEdit ? "Амжилттай засагдлаа" : "Амжилттай хадгаллаа");

      // Detail page руу redirect хийх
      setTimeout(() => {
        router.push(`/job-descriptions/${result.id}`);
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error(`Алдаа гарлаа: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isEdit && formData.id) {
      router.push(`/job-descriptions/${formData.id}`);
    } else {
      router.push("/job-descriptions");
    }
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      await deleteJobDescription(formData.id!); // Устгах үйлдэл
      toast.success("Амжилттай устгагдлаа");
      setTimeout(() => {
        router.push("/job-descriptions");
        router.refresh();
      }, 1500);
    } catch (error) {
      toast.error(`Устгахад алдаа гарлаа: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDelete = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleCommunicationScopeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      communication_scope: value,
    }));
  };

  return (
    <div>
      {isEdit ? (
        <div className="flex justify-end gap-2 mb-4">
          <Button variant="outline" onClick={handleCancel}>
            Буцах
          </Button>
          <Button
            variant="outline"
            className="bg-red-500 hover:bg-red-400"
            onClick={confirmDelete}>
            Устгах
          </Button>
        </div>
      ) : null}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Та устгах үйлдэлд итгэлтэй байна уу?</DialogTitle>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeModal}>
              Болих
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}>
              Устгах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* А. Нийтлэг үндэслэл */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2Icon className="h-5 w-5 text-primary" />
              А. Нийтлэг үндэслэл
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Ажлын байраа сонгоно</Label>
                <PositionSelector
                  value={formData.job_position_id}
                  onChange={handleJobPositionSelect}
                  placeholder="Ажлын байр хайх..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="a_code"
                  className="flex items-center gap-2 min-h-[2.5rem]">
                  Үндэсний ажил мэргэжлийн ангилалын код *
                </Label>
                <Input
                  id="a_code"
                  value={formData.a_code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      a_code: e.target.value,
                    }))
                  }
                  placeholder="жишээ: 2511-11"
                  required
                />
              </div>
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="at_code"
                  className="flex items-center gap-2 min-h-[2.5rem]">
                  Албан тушаалын код *
                </Label>
                <Input
                  id="at_code"
                  value={formData.at_code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      at_code: e.target.value,
                    }))
                  }
                  placeholder="жишээ: 123"
                  required
                />
              </div>
              <div className="flex flex-col space-y-1">
                <Label
                  htmlFor="job_condition"
                  className="flex items-center gap-2 min-h-[2.5rem]">
                  Хөдөлмөрийн нөхцөл *
                </Label>
                <Input
                  id="job_condition"
                  value={formData.job_condition}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      job_condition: e.target.value,
                    }))
                  }
                  placeholder="жишээ: Хэвийн"
                  required
                />
              </div>
            </div>

            {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Шууд харьяалагдах албан тушаал</Label>
                <PositionSelector
                  value={formData.supervisor_pos_id}
                  onChange={handleSupervisorSelect}
                  placeholder="Даргаа сонгоно..."
                />
              </div>

              <div className="space-y-2">
                <Label>Шууд харьяалах албан тушаал</Label>
                <PositionSelector
                  value={formData.subordinate_pos_id}
                  onChange={handleSubordinateSelect}
                  placeholder="Харьяалагдах хүнийг сонгоно..."
                />
              </div>
            </div> */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Шууд харьяалагдах албан тушаал</Label>
                <PositionSelector
                  value={formData.supervisor_pos_id}
                  onChange={handleSupervisorSelect}
                  placeholder="Даргаа сонгоно..."
                  multiple={true}
                />
                <p className="text-xs text-muted-foreground">
                  Нэг эсвэл олон дарга сонгож болно
                </p>
              </div>

              <div className="space-y-2">
                <Label>Шууд харьяалах албан тушаал</Label>
                <PositionSelector
                  value={formData.subordinate_pos_id}
                  onChange={handleSubordinateSelect}
                  placeholder="Харьяалагдах хүнийг сонгоно..."
                  multiple={true}
                />
                <p className="text-xs text-muted-foreground">
                  Нэг эсвэл олон харьяалагдах хүн сонгож болно
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Харилцах хүрээ</Label>
              <CommunicationScopeSelector
                value={formData.communication_scope}
                onChange={handleCommunicationScopeChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* B. Албан тушаалын дэлгэрэнгүй мэдээлэл */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-primary" />
              B. Албан тушаалын дэлгэрэнгүй мэдээлэл
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="purpose">Албан тушаалын зорилго *</Label>
              <Textarea
                id="purpose"
                value={formData.purpose}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    purpose: e.target.value,
                  }))
                }
                placeholder="Албан тушаалын үндсэн зорилго, үүргийг тодорхойлно уу"
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="schedule">
                  Ажлын хуваарийн талаарх мэдээлэл
                </Label>
                <Textarea
                  id="schedule"
                  value={formData.schedule}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      schedule: e.target.value,
                    }))
                  }
                  placeholder="жишээ: 14 хоног ажиллаад 14 хоног амрах хуваариар ажиллана"
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="daily_hours">Ажлын өдрийн цаг</Label>
                  <Input
                    id="daily_hours"
                    value={formData.daily_hours}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        daily_hours: e.target.value,
                      }))
                    }
                    placeholder="жишээ: 10 цаг"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="break_time">Өдрийн цайны цаг</Label>
                  <Input
                    id="break_time"
                    value={formData.break_time}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        break_time: e.target.value,
                      }))
                    }
                    placeholder="жишээ: 1 цаг"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* C. Албан тушаалын гүйцэтгэх үүрэг */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-primary" />
              C. Албан тушаалын гүйцэтгэх үүрэг
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {formData.duties.map((responsibilities, index) => (
                <div key={index} className="flex gap-2">
                  <Badge
                    variant="outline"
                    className="mt-2 min-w-8 justify-center">
                    {index + 1}
                  </Badge>
                  <div className="flex-1 space-y-2">
                    <Textarea
                      value={responsibilities}
                      onChange={(e) =>
                        updateArrayItem("duties", index, e.target.value)
                      }
                      placeholder="Үүрэг хариуцлагыг оруулна уу"
                      rows={2}
                    />
                  </div>
                  {formData.duties.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem("duties", index)}
                      className="mt-2">
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("duties")}
                className="w-full">
                + Үүрэг нэмэх
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* D. Албан тушаалд тавигдах шаардлага */}
        <Card>
          <CardHeader>
            <CardTitle>D. Албан тушаалд тавигдах шаардлага</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="education_level">Боловсролын түвшин *</Label>
                <Textarea
                  id="education_level"
                  value={formData.education_level}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      education_level: e.target.value,
                    }))
                  }
                  placeholder="жишээ: Мэдээллийн технологи, програм хангамж чиглэлээр бакалавр болон түүнээс дээш зэрэг"
                  rows={2}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_experience">Ажлын туршлага *</Label>
                <Textarea
                  id="work_experience"
                  value={formData.work_experience}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      work_experience: e.target.value,
                    }))
                  }
                  placeholder="Шаардагдах ажлын туршлагыг тодорхойлно уу"
                  rows={2}
                  required
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Ерөнхий ур чадвар</h4>
              {formData.general_skills.map((skill, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={skill}
                    onChange={(e) =>
                      updateArrayItem("general_skills", index, e.target.value)
                    }
                    placeholder="Ерөнхий ур чадварыг оруулна уу"
                  />
                  {formData.general_skills.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem("general_skills", index)}>
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("general_skills")}
                size="sm">
                + Ур чадвар нэмэх
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Мэргэжлийн ур чадвар</h4>
              {formData.professional_skills.map((skill, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={skill}
                    onChange={(e) =>
                      updateArrayItem(
                        "professional_skills",
                        index,
                        e.target.value
                      )
                    }
                    placeholder="Мэргэжлийн ур чадварыг оруулна уу"
                  />
                  {formData.professional_skills.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeArrayItem("professional_skills", index)
                      }>
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("professional_skills")}
                size="sm">
                + Ур чадвар нэмэх
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">
                Хамрагдсан байвал зохих сургалтууд
              </h4>
              {formData.additional_courses.map((skill, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={skill}
                    onChange={(e) =>
                      updateArrayItem(
                        "additional_courses",
                        index,
                        e.target.value
                      )
                    }
                    placeholder="Эзэмшсэн байвал зохих сургалтуудыг оруулна уу"
                  />
                  {formData.additional_courses.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeArrayItem("additional_courses", index)
                      }>
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("additional_courses")}
                size="sm">
                + Сургалт нэмэх
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* E. Бусад хүчин зүйлс */}
        <Card>
          <CardHeader>
            <CardTitle>E. Бусад хүчин зүйлс</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="resources">Албан тушаалын нөөц хэрэгсэл</Label>
              <Textarea
                id="resources"
                value={formData.resources}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    resources: e.target.value,
                  }))
                }
                placeholder="Шаардлагатай тоног төхөөрөмж, багаж хэрэгсэл"
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Албан тушаалын эрх мэдэл</h4>
              {formData.authority.map((auth, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={auth}
                    onChange={(e) =>
                      updateArrayItem("authority", index, e.target.value)
                    }
                    placeholder="Эрх мэдлийг оруулна уу"
                    rows={2}
                  />
                  {formData.authority.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem("authority", index)}
                      className="mt-2">
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("authority")}
                size="sm">
                + Эрх мэдэл нэмэх
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Албан тушаалын хариуцлага</h4>
              {formData.responsibilities.map((auth, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={auth}
                    onChange={(e) =>
                      updateArrayItem("responsibilities", index, e.target.value)
                    }
                    placeholder="Хариуцлагыг оруулна уу"
                    rows={2}
                  />
                  {formData.responsibilities.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem("responsibilities", index)}
                      className="mt-2">
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("responsibilities")}
                size="sm">
                + Хариуцлага нэмэх
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Эд хөрөнгийн хариуцлага</h4>
              {formData.property_liability.map((auth, index) => (
                <div key={index} className="flex gap-2">
                  <Textarea
                    value={auth}
                    onChange={(e) =>
                      updateArrayItem(
                        "property_liability",
                        index,
                        e.target.value
                      )
                    }
                    placeholder="Хариуцах эд хөрөнгийг оруулна уу"
                    rows={2}
                  />
                  {formData.property_liability.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        removeArrayItem("property_liability", index)
                      }
                      className="mt-2">
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("property_liability")}
                size="sm">
                + Эд хөрөнгө
              </Button>
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Холбогдох хууль тогтоомж</h4>
              {formData.relevant_laws.map((law, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={law}
                    onChange={(e) =>
                      updateArrayItem("relevant_laws", index, e.target.value)
                    }
                    placeholder="Хууль тогтоомжийг оруулна уу"
                  />
                  {formData.relevant_laws.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeArrayItem("relevant_laws", index)}>
                      Устгах
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addArrayItem("relevant_laws")}
                size="sm">
                + Хууль нэмэх
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Бусад тэмдэглэл</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Нэмэлт тэмдэглэл, тайлбар"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}>
            Цуцлах
          </Button>
          <Button type="submit" className="px-8" disabled={isLoading}>
            {isLoading ? "Хадгалж байна..." : isEdit ? "Засах" : "Хадгалах"}
          </Button>
        </div>
      </form>
    </div>
  );
}
