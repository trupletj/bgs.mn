import { cn } from "@/lib/utils";

/** Төслийн нэгдсэн эргэлдэх спиннер. */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Ачаалж байна"
      className={cn(
        "animate-spin rounded-full border-4 border-primary border-t-transparent",
        className,
      )}
    />
  );
}

/**
 * Хуудас руу шилжих үеийн нэгдсэн loader (бүх `loading.tsx`-д ашиглана).
 * Төвд эргэлдэх спиннер + бичвэр.
 */
export function PageLoader({ label = "Ачаалж байна..." }: { label?: string }) {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-10 w-10" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/**
 * Үйлдлийн (server action + router.refresh) явцад харагдах булангийн индикатор.
 * `busy` (useTransition pending) үнэн үед л харагдана. fixed байрлалтай тул аль ч
 * компонентод нэмж болно — олон нэмэгдсэн ч нэг газар (баруун доод) харагдана.
 */
export function BusyIndicator({ busy }: { busy: boolean }) {
  if (!busy) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-sm shadow-md backdrop-blur">
      <Spinner className="h-4 w-4 border-2" />
      <span className="text-muted-foreground">Ачаалж байна...</span>
    </div>
  );
}
