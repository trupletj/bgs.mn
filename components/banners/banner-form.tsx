"use client";

import { useState } from "react";
import Image from "next/image";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BannerImageField,
  BANNER_ASPECT,
} from "@/components/banners/banner-image-field";
import { createBanner, updateBanner, type BannerRow } from "@/actions/banners";

const NO_NEWS = "none";

const formSchema = z.object({
  title: z.string().min(1, "Гарчиг шаардлагатай"),
  subtitle: z.string().optional(),
  tag: z.string().optional(),
  imageUrl: z.string().url("Зураг оруулна уу"),
  newsId: z.string().optional(),
  linkUrl: z
    .string()
    .url("Зөв URL оруулна уу")
    .optional()
    .or(z.literal("")),
  sortOrder: z.string(),
  publish: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface BannerFormProps {
  initial?: BannerRow;
  newsOptions: { id: number; title: string }[];
  onDone: () => void;
}

export function BannerForm({ initial, newsOptions, onDone }: BannerFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initial?.title ?? "",
      subtitle: initial?.subtitle ?? "",
      tag: initial?.tag ?? "",
      imageUrl: initial?.imageUrl ?? "",
      newsId: initial?.newsId != null ? String(initial.newsId) : NO_NEWS,
      linkUrl: initial?.linkUrl ?? "",
      sortOrder: String(initial?.sortOrder ?? 0),
      publish: initial ? initial.publishedAt !== null : true,
    },
  });

  const imageUrl = form.watch("imageUrl");
  const previewTitle = form.watch("title");
  const previewTag = form.watch("tag");
  const previewSubtitle = form.watch("subtitle");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const payload = {
      title: values.title,
      subtitle: values.subtitle || null,
      tag: values.tag || null,
      imageUrl: values.imageUrl,
      linkUrl: values.linkUrl || null,
      newsId: values.newsId && values.newsId !== NO_NEWS ? Number(values.newsId) : null,
      sortOrder: Number(values.sortOrder) || 0,
      publish: values.publish,
    };
    const result = initial
      ? await updateBanner(initial.id, payload)
      : await createBanner(payload);
    setSubmitting(false);

    if (result.ok) {
      toast.success(initial ? "Баннер шинэчлэгдлээ" : "Баннер нэмэгдлээ");
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
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Зураг</FormLabel>
              <FormControl>
                <BannerImageField value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Урьдчилан харах — mobile-д харагдах байдал */}
        {imageUrl ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Урьдчилан харах</p>
            <div
              className="relative w-full overflow-hidden rounded-2xl border"
              style={{ aspectRatio: String(BANNER_ASPECT) }}
            >
              <Image src={imageUrl} alt="preview" fill className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-4 pb-3 pt-10">
                {previewTag ? (
                  <span className="mb-1.5 inline-block rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {previewTag}
                  </span>
                ) : null}
                <div className="truncate text-base font-extrabold text-white">
                  {previewTitle || "Гарчиг"}
                </div>
                {previewSubtitle ? (
                  <div className="truncate text-xs text-white/90">{previewSubtitle}</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Гарчиг</FormLabel>
              <FormControl>
                <Input placeholder="Баннерын гарчиг" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="tag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Шошго (сонголттой)</FormLabel>
                <FormControl>
                  <Input placeholder="Шинэ / Зар ..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дараалал</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="subtitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дэд гарчиг (сонголттой)</FormLabel>
              <FormControl>
                <Input placeholder="Богино тайлбар" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newsId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Холбоостой мэдээ (сонголттой)</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Мэдээ сонгох" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_NEWS}>— Холбоосгүй —</SelectItem>
                  {newsOptions.map((n) => (
                    <SelectItem key={n.id} value={String(n.id)}>
                      {n.title}
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
          name="linkUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Эсвэл холбоос URL (сонголттой)</FormLabel>
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
