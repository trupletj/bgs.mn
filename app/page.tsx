import { createClient } from "@/utils/supabase/server";
import { RequestOtpForm } from "@/components/login-form";
import { EmbedAutoPost } from "@/components/embed-auto-post";
import { OrbitMark } from "@/components/brand/orbit-mark";
import { redirect } from "next/navigation";
import { Shield, Users, BarChart3, CheckCircle } from "lucide-react";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ embed?: string }>;
}) {
  const params = await searchParams;
  const embed = params.embed === "1";

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (claims && !embed) redirect("/dashboard");

  return (
    <div className="flex min-h-svh">
      {/* ===== Left branding panel ===== */}
      <div className="relative hidden md:flex md:w-[56%] flex-col justify-between overflow-hidden bg-sidebar p-12">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Glow orbs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-1/3 right-1/4 h-64 w-64 rounded-full bg-sky-400/5 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <OrbitMark size={44} variant="reversed" background="#16130F" />
          <div>
            <p className="text-lg font-bold leading-none text-white">
              BGS систем
            </p>
            <p className="mt-0.5 text-xs text-white/40">
              Удирдлагын нэгдсэн платформ
            </p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          {/* <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-white/60">
              Үйлдлийн систем
            </span>
          </div> */}

          <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tight text-white">
            Удирдлагын
            <br />
            нэгдсэн платформ
          </h2>

          <p className="mb-10 max-w-sm text-base leading-relaxed text-white/50">
            Захиалга, ажилтан, журам болон хоолны бүртгэлийг нэг дороос удирдах
            боломжтой дотоод систем.
          </p>

          {/* Feature pills */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Shield, label: "Эрхийн удирдлага" },
              { icon: BarChart3, label: "Статистик мэдээлэл" },
              { icon: Users, label: "Ажилтны бүртгэл" },
              { icon: CheckCircle, label: "Захиалгын урсгал" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/8 backdrop-blur-sm">
                <Icon className="h-4 w-4 shrink-0 text-white/40" />
                <span className="text-sm text-white/60">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/20">
          © 2026 BGS. Бүх эрх хуулиар хамгаалагдсан.
        </p>
      </div>

      {/* ===== Right form panel ===== */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 md:hidden">
          <OrbitMark size={40} variant="primary" />
          <span className="text-xl font-bold">BGS систем</span>
        </div>

        <RequestOtpForm className="w-full max-w-[400px]" />
        {embed && claims ? <EmbedAutoPost /> : null}

        <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
          Нэвтрэхэд асуудал гарвал системийн админтай холбогдоно уу.
        </p>
      </div>
    </div>
  );
}
