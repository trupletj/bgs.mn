import { redirect } from "next/navigation"

export default async function AuditLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    // const session = await auth()
    // if (session?.user) { redirect("/employee") }

    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex w-full max-w-2xl flex-col gap-6">
                {children}
            </div>
        </div>
    );
}
