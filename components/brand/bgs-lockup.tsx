/**
 * BGS lockup-ууд — Orbit mark + wordmark хослолууд.
 * `horizontal` — үндсэн (header, sidebar).
 * `stacked` — нарийн талбайд.
 * `with-tagline` — урианы хамт ("Систем технологи").
 */

import { OrbitMark, ORBIT_COLORS, type OrbitVariant } from "./orbit-mark";
import { BgsWordmark } from "./bgs-wordmark";
import { manrope } from "@/lib/brand-fonts";

type LockupKind = "horizontal" | "stacked" | "with-tagline";

interface BgsLockupProps {
  kind?: LockupKind;
  markSize?: number;
  wordSize?: number;
  variant?: OrbitVariant;
  /** Mark-ийн gap өнгийг override хийх */
  background?: string;
  /** Wordmark өнгө (default: variant-аас деривед). */
  wordColor?: string;
  taglineColor?: string;
  className?: string;
}

function defaultWordColor(variant: OrbitVariant): string {
  if (variant === "reversed") return ORBIT_COLORS.paper;
  if (variant === "accent") return "#ffffff";
  return ORBIT_COLORS.ink;
}

export function BgsLockup({
  kind = "horizontal",
  markSize,
  wordSize,
  variant = "primary",
  background,
  wordColor,
  taglineColor = "#8a8276",
  className,
}: BgsLockupProps) {
  const _markSize = markSize ?? (kind === "horizontal" ? 64 : 70);
  const _wordSize =
    wordSize ?? (kind === "horizontal" ? 46 : kind === "stacked" ? 34 : 30);
  const _wordColor = wordColor ?? defaultWordColor(variant);

  if (kind === "horizontal") {
    return (
      <div
        className={className}
        style={{ display: "flex", alignItems: "center", gap: 18 }}
      >
        <OrbitMark size={_markSize} variant={variant} background={background} />
        <BgsWordmark size={_wordSize} color={_wordColor} />
      </div>
    );
  }

  if (kind === "stacked") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <OrbitMark size={_markSize} variant={variant} background={background} />
        <BgsWordmark size={_wordSize} color={_wordColor} />
      </div>
    );
  }

  // with-tagline
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <OrbitMark
        size={markSize ?? 60}
        variant={variant}
        background={background}
      />
      <BgsWordmark size={wordSize ?? 30} color={_wordColor} />
      <span
        className={manrope.className}
        style={{
          fontWeight: 600,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          fontSize: 8.5,
          color: taglineColor,
        }}
      >
        Систем технологи
      </span>
    </div>
  );
}
