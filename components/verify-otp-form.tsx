"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

const FormSchema = z.object({
  pin: z.string().min(6, { message: "Нэвтрэх код 6 оронтой байх ёстой." }),
});

function VerifyOtpFormInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { pin: "" },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: data.pin,
        type: "sms",
      });

      if (error) {
        toast.error("Код буруу эсвэл хугацаа нь дууссан байна.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Холболтын алдаа гарлаа.");
    }
  }

  const maskedPhone = phone
    ? phone.slice(0, 2) + "****" + phone.slice(-2)
    : "";

  return (
    <div className="w-full">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Буцах
      </Link>

      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Баталгаажуулалт</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {maskedPhone
            ? `${maskedPhone} дугаарт илгээсэн 6 оронтой кодыг оруулна уу`
            : "Утсанд ирсэн 6 оронтой кодыг оруулна уу"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <InputOTP maxLength={6} {...field} disabled={isSubmitting}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-12 rounded-xl border-border text-lg font-semibold first:rounded-xl last:rounded-xl"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-11 w-full text-sm font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Шалгаж байна...
              </>
            ) : (
              "Баталгаажуулах"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export function VerifyOtpForm() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyOtpFormInner />
    </Suspense>
  );
}
