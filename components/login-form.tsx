"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";

export function RequestOtpForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const supabase = createClient();
  const [register, setReg] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setIsLoading(true);

    try {
      const { data: verifyData, error: verifyError } =
        await supabase.functions.invoke("verify-user", {
          body: { phone, register },
        });

      if (verifyError || (verifyData && verifyData.error)) {
        setError(verifyError?.message || verifyData?.error || "Шалгалт амжилтгүй");
        setIsLoading(false);
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          shouldCreateUser: true,
          data: { register_number: register },
        },
      });

      if (otpError) {
        setError(`OTP илгээхэд алдаа гарлаа: ${otpError.message}`);
        setIsLoading(false);
        return;
      }

      router.push(`/otp?phone=${phone}&register=${register}`);
    } catch (err: any) {
      setError(err.message || "Гэнэтийн алдаа гарлаа");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Тавтай морил
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Регистрийн дугаар болон утасны дугаараа оруулна уу
        </p>
      </div>

      <form onSubmit={onRequest} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="register" className="text-sm font-medium">
            Регистрийн дугаар
          </Label>
          <Input
            id="register"
            value={register}
            onChange={(e) => setReg(e.target.value.toUpperCase())}
            type="text"
            placeholder="АА00000000"
            required
            className="h-11 font-mono tracking-widest uppercase"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Утасны дугаар
          </Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="99001234"
            required
            className="h-11"
          />
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="h-11 w-full text-sm font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Шалгаж байна...
            </>
          ) : (
            "Нэвтрэх"
          )}
        </Button>
      </form>
    </div>
  );
}
