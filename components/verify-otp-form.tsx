"use client";
import { redirect, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";
const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Нэвтрэх код 6 оронтой байх ёстой.",
  }),
});

function VerifyOtpFormInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const router = useRouter();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
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
    } catch (err) {
      toast.error("Холболтын алдаа гарлаа.");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-2/3 space-y-6">
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Баталгаажуулах код</FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field} disabled={isSubmitting}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormDescription>
                Утсанд ирсэн 6 оронтой кодыг оруулна уу.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="" disabled={isSubmitting}>
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
  );
}

export function VerifyOtpForm() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
      <VerifyOtpFormInner />
    </Suspense>
  );
}
