import { spaceGrotesk, manrope, jetbrainsMono } from "@/lib/brand-fonts";

/**
 * Brand sheet root layout — Space Grotesk / Manrope / JetBrains Mono
 * CSS variable-уудыг идэвхжүүлнэ.
 */
export default function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      style={{
        fontFamily: "var(--font-manrope), system-ui, sans-serif",
        background: "#EDE8E0",
        minHeight: "100vh",
        color: "#16130F",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </div>
  );
}
