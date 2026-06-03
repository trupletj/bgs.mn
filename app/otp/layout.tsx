import { OrbitMark } from "@/components/brand/orbit-mark";

export default function OtpLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="mb-8 flex items-center gap-3 md:hidden">
        <OrbitMark size={40} variant="primary" />
        <span className="text-xl font-bold">BGS систем</span>
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
