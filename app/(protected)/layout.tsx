import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getNavServices } from "@/actions/nav";
import { getQrPayload } from "@/actions/profile";

export default async function AuditLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/");

  const { data: authUser } = await supabase.auth.getUser();

  let userName = "Хэрэглэгч";
  let userEmail = authUser.user?.email ?? "";

  if (authUser.user) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("auth_user_id", authUser.user.id)
      .single();

    if (userRecord) {
      const firstName = userRecord.first_name ?? "";
      const lastInitial = userRecord.last_name?.[0] ?? "";
      const displayName = lastInitial
        ? `${lastInitial}. ${firstName}`.trim()
        : firstName;
      if (displayName) userName = displayName;
      if (userRecord.email) userEmail = userRecord.email;
    }
  }

  const [services, qrPayload] = await Promise.all([
    getNavServices(),
    getQrPayload(),
  ]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }>
      <AppSidebar
        variant="inset"
        services={services}
        user={{ name: userName, email: userEmail, avatar: "" }}
        qrPayload={qrPayload}
      />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
