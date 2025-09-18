import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server";

export default async function AuditLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
const supabase = await createClient()
const { data: claims} = await supabase.auth.getClaims()
    if(!claims) redirect("/")

    return (
       <>
         {children}
       </>
    );
}
