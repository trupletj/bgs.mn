import { Building2 } from "lucide-react";

export default function OtpLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="mb-8 flex items-center gap-3 md:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold">BGS систем</span>
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
