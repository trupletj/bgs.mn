"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, UserPlus, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserSearchPicker } from "@/components/users/user-search-picker";
import type { UserSearchResult } from "@/actions/users";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createMealOverrides } from "@/actions/meal-override";

type DiningHall = {
  id: number;
  name: string;
};

const formSchema = z.object({
  selected_users: z
    .array(
      z.object({
        user_id: z.string(),
        nice_name: z.string(),
        bteg_id: z.string(),
      }),
    )
    .min(1, "Ядаж нэг ажилтан сонгоно уу"),
  dateRange: z
    .object({
      from: z.union([z.date(), z.undefined()]),
      to: z.union([z.date(), z.undefined()]),
    })
    .refine((value) => value.from && !isNaN(value.from.getTime()), {
      message: "Эхлэх өдөр сонгоно уу",
    }),
  meal_type: z.enum([
    "breakfast",
    "morning_meal",
    "lunch",
    "dinner",
    "night_meal",
  ]),
  dining_hall_id: z.string().min(1, "Гал тогоо сонгоно уу"),
  note: z.string().optional(),
});

function formatDateRangeLabel(range?: DateRange) {
  if (!range?.from) return "Сонгох";

  if (!range.to || range.from.getTime() === range.to.getTime()) {
    return format(range.from, "yyyy-MM-dd");
  }

  return `${format(range.from, "yyyy-MM-dd")} - ${format(range.to, "yyyy-MM-dd")}`;
}

function getDatesInRange(range: DateRange) {
  if (!range.from) return [];

  const dates: Date[] = [];
  const current = new Date(range.from);
  const end = range.to ? new Date(range.to) : new Date(range.from);

  current.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export default function OverrideForm({
  diningHalls,
  initialDate,
}: {
  diningHalls: DiningHall[];
  initialDate?: string;
}) {
  const [loading, setLoading] = useState(false);
  const defaultDate = initialDate
    ? new Date(`${initialDate}T00:00:00`)
    : new Date();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selected_users: [],
      dateRange: { from: defaultDate, to: defaultDate },
      meal_type: "lunch",
      note: "",
    },
  });
  const selectedUsers = form.watch("selected_users");
  const selectedDateRange = form.watch("dateRange");
  const assignmentCount =
    selectedUsers.length * getDatesInRange(selectedDateRange).length;

  const handleAddUser = (user: UserSearchResult) => {
    const current = form.getValues("selected_users");
    if (current.some((u) => u.user_id === user.id)) return;

    const fullName = [user.last_name, user.first_name]
      .filter(Boolean)
      .join(" ");
    form.setValue(
      "selected_users",
      [
        ...current,
        {
          user_id: user.id,
          nice_name: user.nice_name || fullName || "Нэргүй",
          bteg_id: user.bteg_id ?? "",
        },
      ],
      { shouldValidate: true, shouldDirty: true },
    );
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const dates = getDatesInRange(values.dateRange);
      const overrides = values.selected_users.flatMap((user) =>
        dates.map((date) => ({
          user_id: user.user_id,
          bteg_id: user.bteg_id,
          date: format(date, "yyyy-MM-dd"),
          meal_type: values.meal_type,
          dining_hall_id: parseInt(values.dining_hall_id),
          note: values.note,
        })),
      );

      await createMealOverrides(overrides);

      toast.success("Түр хуваарилалт амжилттай хадгалагдлаа");
      form.reset({
        ...form.getValues(),
        selected_users: [],
        note: "",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Алдаа гарлаа";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const removeUser = (userId: string) => {
    const currentUsers = form.getValues("selected_users");

    const filteredUsers = currentUsers.filter((u) => u.user_id !== userId);

    form.setValue("selected_users", filteredUsers, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Олон ажилтан сонгох хэсэг */}
        <div className="space-y-2">
          <FormLabel>Ажилтан нэмэх</FormLabel>
          <div className="flex flex-wrap items-center gap-2 p-2 min-h-[50px] w-full bg-background">
            {selectedUsers.map((user) => (
              <Badge
                key={user.user_id}
                variant="secondary"
                className="flex items-center gap-1 max-w-full h-auto py-1 px-2 whitespace-normal shrink-0">
                <span className="text-xs leading-tight">{user.nice_name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeUser(user.user_id);
                  }}
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            ))}

            {selectedUsers.length === 0 && (
              <span className="text-muted-foreground text-sm">
                Ажилтан сонгогдоогүй...
              </span>
            )}
          </div>

          <UserSearchPicker
            placeholder="Нэр, овог, утас, албан тушаал..."
            excludeIds={selectedUsers.map((u) => u.user_id)}
            onSelect={handleAddUser}
          />
          <FormMessage>
            {form.formState.errors.selected_users?.message}
          </FormMessage>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dateRange"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Өдрийн интервал</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}>
                        <span className="truncate">
                          {formatDateRangeLabel(field.value)}
                        </span>
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      numberOfMonths={2}
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="meal_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Хоолны төрөл</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="breakfast">Өглөөний цай</SelectItem>
                    <SelectItem value="morning_meal">Өглөөний хоол</SelectItem>
                    <SelectItem value="lunch">Өдрийн хоол</SelectItem>
                    <SelectItem value="dinner">Оройн хоол</SelectItem>
                    <SelectItem value="night_meal">Шөнийн хоол</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dining_hall_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Очих гал тогоо</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {diningHalls.map((hall) => (
                    <SelectItem key={hall.id} value={hall.id.toString()}>
                      {hall.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Тэмдэглэл</FormLabel>
              <FormControl>
                <Input placeholder="Нэмэлт тайлбар..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Хуваарилах ({assignmentCount})
        </Button>
      </form>
    </Form>
  );
}
