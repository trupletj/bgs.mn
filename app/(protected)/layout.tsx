import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getNavServices } from "@/actions/nav";

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
    const { data: profile } = await supabase
      .from("profile")
      .select("first_name, last_name, email")
      .eq("auth_user_id", authUser.user.id)
      .single();

    if (profile) {
      const fullName = [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" ");
      if (fullName) userName = fullName;
      if (profile.email) userEmail = profile.email;
    }
  }

  const services = await getNavServices();

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
