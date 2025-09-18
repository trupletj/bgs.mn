import Image from "next/image";
import { createClient } from '@/utils/supabase/server'
import { RequestOtpForm } from "@/components/login-form"
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient()
  const {data : claims} = await supabase.auth.getClaims()
  if(claims) redirect('/dashboard')
  return (
     <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex w-full max-w-2xl flex-col gap-6">
                 <RequestOtpForm />
            </div>
        </div>
  );
}
