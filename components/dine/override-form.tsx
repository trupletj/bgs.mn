"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  Loader2,
  UserPlus,
  Check,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { useDebounce } from "use-debounce";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createMealOverride, searchUsers } from "@/actions/meal-override";

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
  date: z.date().refine((value) => !isNaN(value.getTime()), {
    message: "Өдөр сонгоно уу",
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

export default function OverrideForm({ diningHalls }: { diningHalls: any[] }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch] = useDebounce(searchTerm, 500);
  const [users, setUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selected_users: [],
      date: new Date(),
      meal_type: "lunch",
      note: "",
    },
  });

  useEffect(() => {
    const fetchUsers = async () => {
      if (debouncedSearch.length < 2) {
        setUsers([]);
        return;
      }
      setIsSearching(true);
      const results = await searchUsers(debouncedSearch);
      setUsers(results);
      setIsSearching(false);
    };
    fetchUsers();
  }, [debouncedSearch]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const promises = values.selected_users.map((user) =>
        createMealOverride({
          user_id: user.user_id,
          bteg_id: user.bteg_id,
          date: format(values.date, "yyyy-MM-dd"),
          meal_type: values.meal_type,
          dining_hall_id: parseInt(values.dining_hall_id),
          note: values.note,
        }),
      );

      await Promise.all(promises);

      toast.success("Түр хуваарилалт амжилттай хадгалагдлаа");
      form.reset({
        ...form.getValues(),
        selected_users: [],
        note: "",
      });
      setSearchTerm("");
    } catch (error: any) {
      toast.error(error.message || "Алдаа гарлаа");
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
            {form.watch("selected_users").map((user) => (
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

            {form.watch("selected_users").length === 0 && (
              <span className="text-muted-foreground text-sm">
                Ажилтан сонгогдоогүй...
              </span>
            )}
          </div>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-normal">
                <span>Ажилтан хайх...</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Нэрээр хайх..."
                  onValueChange={setSearchTerm}
                />
                <CommandList>
                  {isSearching && (
                    <div className="p-4 text-sm text-center">Хайж байна...</div>
                  )}
                  <CommandEmpty>Ажилтан олдсонгүй.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => {
                      const isSelected = form
                        .watch("selected_users")
                        .some((u) => u.user_id === user.id);
                      return (
                        <CommandItem
                          key={user.id}
                          onSelect={() => {
                            if (!isSelected) {
                              form.setValue("selected_users", [
                                ...form.getValues("selected_users"),
                                {
                                  user_id: user.id,
                                  nice_name: user.nice_name,
                                  bteg_id: user.bteg_id,
                                },
                              ]);
                            } else {
                              removeUser(user.id);
                            }
                            setOpen(false);
                          }}>
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col text-sm">
                            <span>{user.nice_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.position_name}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <FormMessage>
            {form.formState.errors.selected_users?.message}
          </FormMessage>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Өдөр</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground",
                        )}>
                        {field.value ? (
                          format(field.value, "yyyy-MM-dd")
                        ) : (
                          <span>Сонгох</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
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
          Хуваарилах ({form.watch("selected_users").length})
        </Button>
      </form>
    </Form>
  );
}
