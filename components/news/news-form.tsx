"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { createNews, updateNews, type NewsRow } from "@/actions/news";

const formSchema = z.object({
  title: z.string().min(1, "Гарчиг шаардлагатай"),
  description: z.string().min(1, "Товч тайлбар шаардлагатай"),
  body: z.string().optional(),
  imageUrl: z
    .string()
    .url("Зөв зургийн URL оруулна уу")
    .optional()
    .or(z.literal("")),
  publish: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface NewsFormProps {
  initial?: NewsRow;
  onDone: () => void;
}

export function NewsForm({ initial, onDone }: NewsFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      body: initial?.body ?? "",
      imageUrl: initial?.imageUrl ?? "",
      publish: initial ? initial.publishedAt !== null : true,
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const payload = {
      title: values.title,
      description: values.description,
      body: values.body || null,
      imageUrl: values.imageUrl || null,
      publish: values.publish,
    };
    const result = initial
      ? await updateNews(initial.id, payload)
      : await createNews(payload);
    setSubmitting(false);

    if (result.ok) {
      toast.success(initial ? "Мэдээ шинэчлэгдлээ" : "Мэдээ нэмэгдлээ");
      onDone();
    } else {
      toast.error(result.error || "Алдаа гарлаа");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Гарчиг</FormLabel>
              <FormControl>
                <Input placeholder="Мэдээний гарчиг" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Товч тайлбар</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Жагсаалтад харагдах товч тайлбар" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дэлгэрэнгүй (сонголттой)</FormLabel>
              <FormControl>
                <Textarea rows={5} placeholder="Мэдээний бүрэн агуулга" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Зургийн URL (сонголттой)</FormLabel>
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="publish"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <FormLabel>Нийтлэх</FormLabel>
                <p className="text-xs text-muted-foreground mt-1">
                  Идэвхгүй бол ноорог хэлбэрээр хадгална.
                </p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={submitting}>
            Болих
          </Button>
          <Button type="submit" disabled={submitting}>
            {initial ? "Хадгалах" : "Нэмэх"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
