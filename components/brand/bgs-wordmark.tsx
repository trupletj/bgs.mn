/**
 * BGS wordmark — Space Grotesk 700, маш бага (-0.03em) letter-spacing.
 * `dot=true` бол сүүлд улбар шар цэг гаргана (примари wordmark style).
 */

import { spaceGrotesk } from "@/lib/brand-fonts";
import { ORBIT_COLORS } from "./orbit-mark";

interface BgsWordmarkProps {
  size?: number;
  /** Үсгийн өнгө */
  color?: string;
  /** "." accent цэг харуулах эсэх */
  dot?: boolean;
  /** Accent цэгийн өнгө */
  accent?: string;
  className?: string;
}

export function BgsWordmark({
  size = 40,
  color = ORBIT_COLORS.ink,
  dot = false,
  accent = ORBIT_COLORS.accent,
  className,
}: BgsWordmarkProps) {
  return (
    <span
      className={`${spaceGrotesk.className} ${className ?? ""}`}
      style={{
        fontWeight: 700,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        fontSize: size,
        color,
        whiteSpace: "nowrap",
      }}
    >
      BGS
      {dot ? <span style={{ color: accent }}>.</span> : null}
    </span>
  );
}
