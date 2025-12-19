"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import {
  createOrderProcess,
  updateOrderProcess,
  OrderProcessFormData,
} from "@/actions/order-process";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X, Users, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Schema шинэчлэх
const stepSchema = z.object({
  step_order: z.number().int().positive(),
  step_name: z.string().min(1, "Алхмын нэр шаардлагатай"),
  role_ids: z.array(z.number()).min(1, "Дор хаяж 1 role сонгоно уу"),
  required_approval_count: z
    .number()
    .int()
    .min(1, "Дор хаяж 1 баталгаажуулалт шаардлагатай")
    .max(10, "10-аас ихгүй баталгаажуулалт байх боломжтой"),
});

const formSchema = z.object({
  name: z.string().min(1, "Захиалгын процессын нэр шаардлагатай"),
  steps: z.array(stepSchema).min(1, "Дор хаяж 1 step оруулна уу"),
});

type FormValues = z.infer<typeof formSchema>;

interface Role {
  id: number;
  display_name: string;
}

interface StepData {
  step_order: number;
  step_name: string;
  role_ids: number[];
  required_approval_count: number;
}

interface OrderProcessFormProps {
  roles: Role[];
  initialData?: {
    id?: number;
    name: string;
    steps: StepData[];
  };
  isEdit?: boolean;
}

export default function OrderProcessForm({
  roles,
  initialData,
  isEdit = false,
}: OrderProcessFormProps) {
  const [openPopovers, setOpenPopovers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const defaultValues: FormValues = {
    name: "",
    steps: [
      {
        step_order: 1,
        step_name: "",
        role_ids: [],
        required_approval_count: 1,
      },
    ],
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "steps",
  });

  // Initial data-г form-д оруулах
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        steps: initialData.steps,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: FormValues) => {
    setLoading(true);
    try {
      const formattedData: OrderProcessFormData = {
        name: data.name,
        steps: data.steps.map((s, index) => ({
          ...s,
          step_order: index + 1,
          required_approval_count: s.required_approval_count || 1,
        })),
      };

      let result;
      if (isEdit && initialData?.id) {
        result = await updateOrderProcess(initialData.id, formattedData);
      } else {
        result = await createOrderProcess(formattedData);
      }

      if (result.success) {
        toast.success(
          `${data.name} захиалгын төрөл амжилттай ${
            isEdit ? "шинэчлэгдлээ" : "үүслээ"
          }.`
        );
        router.push("/order-processes");
        router.refresh();
      } else {
        toast.error(`Алдаа гарлаа: ${result.error ?? "Тодорхойгүй алдаа"}`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Алдаа гарлаа: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const togglePopover = (index: number) => {
    setOpenPopovers((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const removeRole = (stepIndex: number, roleId: number) => {
    const currentIds = watch(`steps.${stepIndex}.role_ids`) || [];
    setValue(
      `steps.${stepIndex}.role_ids`,
      currentIds.filter((id) => id !== roleId)
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-2">
        <Label className="text-lg font-semibold">Захиалгын төрлийн нэр</Label>
        <Input
          {...register("name")}
          placeholder="Жишээ: Сэлбэг захиалах процесс"
          className="h-10 text-base"
        />
        {errors.name && (
          <p className="text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Үе шатууд ({fields.length})</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                step_order: fields.length + 1,
                step_name: "",
                role_ids: [],
                required_approval_count: 1,
              })
            }>
            + Алхам нэмэх
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fields.map((field, index) => {
            const selectedRoleIds = watch(`steps.${index}.role_ids`) || [];
            const selectedRoles = roles.filter((r) =>
              selectedRoleIds.includes(r.id)
            );
            const requiredApprovalCount = watch(
              `steps.${index}.required_approval_count`
            );

            return (
              <div
                key={field.id}
                className="border rounded-lg p-5 space-y-4 bg-card shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-base font-medium">
                    Алхам {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}>
                      Устгах
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Алхмын нэр</Label>
                  <Input
                    {...register(`steps.${index}.step_name`)}
                    placeholder="Жишээ: Захиалга хүлээн авах"
                    className="h-9 text-sm"
                  />
                  {errors.steps?.[index]?.step_name && (
                    <p className="text-xs text-red-600">
                      {errors.steps[index]?.step_name?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1">
                      Баталгаажуулалтын тоо
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            Энэ алхамд хэдэн хүний баталгаажуулалт шаардлагатайг
                            зааж өгнө
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Users className="h-3 w-3 mr-1" />
                      {requiredApprovalCount} хүн
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      {...register(`steps.${index}.required_approval_count`, {
                        valueAsNumber: true,
                      })}
                      className="h-9 text-sm"
                    />
                  </div>
                  {errors.steps?.[index]?.required_approval_count && (
                    <p className="text-xs text-red-600">
                      {errors.steps[index]?.required_approval_count?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Шаардлагатай roles</Label>
                  <Popover
                    open={openPopovers.includes(index)}
                    onOpenChange={(open) =>
                      open
                        ? togglePopover(index)
                        : setOpenPopovers((prev) =>
                            prev.filter((i) => i !== index)
                          )
                    }>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between h-9 text-sm">
                        <span className="truncate">
                          {selectedRoles.length === 0
                            ? "Role сонгох..."
                            : `${selectedRoles.length} role сонгогдсон`}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0 max-w-md">
                      <Command>
                        <CommandInput
                          placeholder="Role хайх..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>Role олдсонгүй</CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-60">
                              {roles.map((role) => {
                                const isSelected = selectedRoleIds.includes(
                                  role.id
                                );
                                return (
                                  <CommandItem
                                    key={role.id}
                                    onSelect={() => {
                                      const newIds = isSelected
                                        ? selectedRoleIds.filter(
                                            (id) => id !== role.id
                                          )
                                        : [...selectedRoleIds, role.id];
                                      setValue(
                                        `steps.${index}.role_ids`,
                                        newIds
                                      );
                                    }}
                                    className="flex items-center space-x-2 text-sm py-2">
                                    <Checkbox checked={isSelected} />
                                    <span className="flex-1">
                                      {role.display_name}
                                    </span>
                                    <Check
                                      className={cn(
                                        "h-4 w-4",
                                        isSelected ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                  </CommandItem>
                                );
                              })}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {errors.steps?.[index]?.role_ids && (
                    <p className="text-xs text-red-600">
                      {errors.steps[index]?.role_ids?.message}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedRoles.map((role) => (
                      <Badge
                        key={role.id}
                        variant="secondary"
                        className="text-xs pl-2 pr-1 py-0.5">
                        {role.display_name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 -mr-1"
                          onClick={() => removeRole(index, role.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>

                  {/* Баталгаажуулалтын тоо хэт их эсэхийг анхааруулах */}
                  {selectedRoles.length > 0 &&
                    requiredApprovalCount > selectedRoles.length && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                        ⚠️ Баталгаажуулалтын тоо ({requiredApprovalCount}) нь
                        сонгогдсон roles-ын тооноос ({selectedRoles.length}) их
                        байна.
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-8 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}>
          Буцах
        </Button>
        <Button type="submit" disabled={isSubmitting || loading}>
          {loading ? "Хадгалж байна..." : isEdit ? "Хадгалах" : "Үүсгэх"}
        </Button>
      </div>
    </form>
  );
}
