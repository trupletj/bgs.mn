/**
 * BGS Orbit mark — brand-sheet-аас (claude.ai/design-аар үүсгэсэн).
 * Цагираг = тогтвортой систем. Улбар шар зангилаа = хөдөлгөөн, тэлэлт.
 *
 * `background` prop нь зангилааны "халтгай" (gap)-ийг дэвсгэртэй
 * тааруулахад хэрэглэнэ — зангилааны эргэн тойронд цагирагтай давхцлыг
 * арилгана. Үүнгүй бол variant-ын анхдагч gap өнгийг хэрэглэнэ.
 */

export type OrbitVariant = "primary" | "reversed" | "accent" | "mono";

const COLORS = {
  ink: "#16130F",
  accent: "#FD6A02",
  paper: "#FAF8F5",
  paper2: "#F1ECE4",
} as const;

const VARIANTS: Record<
  OrbitVariant,
  { ring: string; node: string; gap: string }
> = {
  primary: { ring: COLORS.ink, node: COLORS.accent, gap: COLORS.paper },
  reversed: { ring: COLORS.paper, node: COLORS.accent, gap: COLORS.ink },
  accent: { ring: "#ffffff", node: COLORS.ink, gap: COLORS.accent },
  mono: { ring: COLORS.ink, node: COLORS.ink, gap: COLORS.paper2 },
};

interface OrbitMarkProps {
  size?: number;
  variant?: OrbitVariant;
  /** Зангилааны gap өнгийг override хийх (дэвсгэртэй яг таарах нь чухал). */
  background?: string;
  className?: string;
  title?: string;
}

export function OrbitMark({
  size = 120,
  variant = "primary",
  background,
  className,
  title = "BGS",
}: OrbitMarkProps) {
  const v = VARIANTS[variant];
  const gap = background ?? v.gap;
  const stroke = size * 0.095;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      <circle cx="60" cy="60" r="44" stroke={v.ring} strokeWidth={stroke} />
      <circle cx="91.1" cy="28.9" r="20" fill={gap} />
      <circle cx="91.1" cy="28.9" r="13" fill={v.node} />
    </svg>
  );
}

export const ORBIT_COLORS = COLORS;
