"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ORBIT_COLORS } from "./orbit-mark";

const C = ORBIT_COLORS;

/** Raw mark SVG string — браузер дээр blob болгож татна. */
function markSvgString({
  size,
  ring,
  node,
  gap,
}: {
  size: number;
  ring: string;
  node: string;
  gap: string;
}) {
  const stroke = size * 0.095;
  return `<svg width="${size}" height="${size}" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="44" stroke="${ring}" stroke-width="${stroke / (size / 120)}"/>
    <circle cx="91.1" cy="28.9" r="20" fill="${gap}"/>
    <circle cx="91.1" cy="28.9" r="13" fill="${node}"/>
  </svg>`;
}

function markInner({
  ring,
  node,
  gap,
}: {
  ring: string;
  node: string;
  gap: string;
}) {
  return `<circle cx="60" cy="60" r="44" stroke="${ring}" stroke-width="11.4"/>
    <circle cx="91.1" cy="28.9" r="20" fill="${gap}"/>
    <circle cx="91.1" cy="28.9" r="13" fill="${node}"/>`;
}

const EXPORTS: Record<string, string> = {
  "mark-light": markSvgString({
    size: 512,
    ring: C.ink,
    node: C.accent,
    gap: C.paper,
  }),
  "mark-dark": markSvgString({
    size: 512,
    ring: "#FFFFFF",
    node: C.accent,
    gap: C.ink,
  }),
  icon: `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="115" fill="${C.ink}"/>
    <g transform="translate(106,106) scale(2.5)">${markInner({ ring: C.paper, node: C.accent, gap: C.ink })}</g>
  </svg>`,
  "lockup-h": `<svg width="640" height="180" viewBox="0 0 640 180" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(20,30)">${markInner({ ring: C.ink, node: C.accent, gap: "#FFFFFF" })}</g>
    <text x="180" y="120" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="120" letter-spacing="-3" fill="${C.ink}">BGS</text>
  </svg>`,
  "lockup-v": `<svg width="360" height="460" viewBox="0 0 360 460" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(120,30)">${markInner({ ring: C.ink, node: C.accent, gap: "#FFFFFF" })}</g>
    <text x="180" y="420" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="120" letter-spacing="-3" fill="${C.ink}">BGS</text>
  </svg>`,
};

function downloadSvg(key: string) {
  const svg = EXPORTS[key];
  if (!svg) return;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BGS-${key}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const ITEMS: { key: keyof typeof EXPORTS; label: string; primary?: boolean }[] =
  [
    { key: "mark-light", label: "Тэмдэг (бэх)", primary: true },
    { key: "mark-dark", label: "Тэмдэг (цагаан)" },
    { key: "lockup-h", label: "Хэвтээ lockup" },
    { key: "lockup-v", label: "Босоо lockup" },
    { key: "icon", label: "Апп icon" },
  ];

export function BrandDownloads() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {ITEMS.map((it) => (
        <Button
          key={it.key}
          variant={it.primary ? "default" : "outline"}
          onClick={() => downloadSvg(it.key)}
          style={{
            fontFamily: "var(--font-manrope), sans-serif",
            fontWeight: 600,
            fontSize: 13,
            background: it.primary ? "#FD6A02" : "transparent",
            borderColor: it.primary ? "#FD6A02" : "#16130F",
            color: it.primary ? "#fff" : "#16130F",
            borderRadius: 9,
            padding: "11px 18px",
            height: "auto",
          }}
        >
          <Download className="h-4 w-4" />
          {it.label}
        </Button>
      ))}
    </div>
  );
}
