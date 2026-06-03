import { OrbitMark, ORBIT_COLORS } from "@/components/brand/orbit-mark";
import { BgsWordmark } from "@/components/brand/bgs-wordmark";
import { BgsLockup } from "@/components/brand/bgs-lockup";
import { BrandDownloads } from "@/components/brand/svg-exports";
import {
  spaceGrotesk,
  manrope,
  jetbrainsMono,
} from "@/lib/brand-fonts";

const C = ORBIT_COLORS;

const styles = {
  page: { maxWidth: 1080, margin: "0 auto", padding: "0 0 80px" },
  sheet: { background: C.paper },
  hero: {
    background: C.ink,
    color: C.paper,
    padding: "74px 60px 66px",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  section: {
    padding: "54px 60px",
    borderTop: "1px solid #E3DDD2",
  },
  secHead: {
    display: "flex",
    alignItems: "baseline" as const,
    gap: 14,
    marginBottom: 30,
  },
  secNum: {
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 12,
    color: C.accent,
    letterSpacing: "0.1em",
  },
  secTitle: {
    fontFamily: "var(--font-space-grotesk), sans-serif",
    fontWeight: 600,
    fontSize: 22,
    letterSpacing: "-0.01em",
  },
  secSub: {
    color: "#8a8276",
    fontSize: 13,
    marginLeft: "auto",
    maxWidth: 340,
    textAlign: "right" as const,
    lineHeight: 1.5,
  },
  tile: {
    background: C.paper,
    border: "1px solid #E3DDD2",
    borderRadius: 14,
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  lbl: {
    position: "absolute" as const,
    left: 14,
    bottom: 11,
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "#8a8276",
  },
  lblOnDark: {
    position: "absolute" as const,
    left: 14,
    bottom: 11,
    fontFamily: "var(--font-jetbrains-mono), monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.65)",
  },
} as const;

function SectionHead({
  num,
  title,
  sub,
}: {
  num: string;
  title: string;
  sub: string;
}) {
  return (
    <div style={styles.secHead}>
      <span style={styles.secNum}>{num}</span>
      <span style={styles.secTitle}>{title}</span>
      <span style={styles.secSub}>{sub}</span>
    </div>
  );
}

// Construction grid SVG (overlay grid + dashed clearspace guides)
function ConstructionGrid() {
  const s = 200;
  const r = 44 * (s / 120);
  const cx = 60 * (s / 120);
  const cy = 60 * (s / 120);
  const nx = 91.1 * (s / 120);
  const ny = 28.9 * (s / 120);
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
      <defs>
        <pattern
          id="g"
          width={s / 10}
          height={s / 10}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${s / 10} 0 L 0 0 0 ${s / 10}`}
            fill="none"
            stroke="#E3DDD2"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width={s} height={s} fill="url(#g)" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={C.ink}
        strokeWidth={s * 0.095 / (s / 120)}
      />
      <circle cx={nx} cy={ny} r={20 * (s / 120)} fill={C.paper} />
      <circle cx={nx} cy={ny} r={13 * (s / 120)} fill={C.accent} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={C.accent}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
      />
      <circle
        cx={nx}
        cy={ny}
        r={20 * (s / 120)}
        stroke={C.accent}
        strokeWidth={1}
        strokeDasharray="3 3"
        opacity={0.5}
        fill="none"
      />
    </svg>
  );
}

function ClearspaceGuide() {
  const s = 200;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
      <rect
        x="34"
        y="34"
        width="132"
        height="132"
        stroke={C.accent}
        strokeWidth={1}
        strokeDasharray="4 4"
        fill="none"
        opacity={0.55}
      />
      <g transform={`translate(50,50) scale(${100 / 120})`}>
        <circle cx="60" cy="60" r="44" stroke={C.ink} strokeWidth="11.4" />
        <circle cx="91.1" cy="28.9" r="20" fill={C.paper2} />
        <circle cx="91.1" cy="28.9" r="13" fill={C.accent} />
      </g>
      <text
        x="20"
        y="104"
        fontFamily="var(--font-jetbrains-mono), monospace"
        fontSize="9"
        fill="#8a8276"
      >
        ½x
      </text>
    </svg>
  );
}

const SWATCHES = [
  { name: "BGS Orange", hex: "#FD6A02", bg: "#FD6A02", fg: "#fff" },
  { name: "Deep", hex: "#E25C00", bg: "#E25C00", fg: "#fff" },
  { name: "Ink", hex: "#16130F", bg: "#16130F", fg: "#fff" },
  { name: "Paper 2", hex: "#F1ECE4", bg: "#F1ECE4", fg: "#16130F" },
  { name: "Paper", hex: "#FAF8F5", bg: "#FAF8F5", fg: "#16130F" },
];

function AppIcon({
  px,
  radiusPct,
  bg,
  ring,
  node,
  gap,
}: {
  px: number;
  radiusPct: number;
  bg: string;
  ring: string;
  node: string;
  gap: string;
}) {
  return (
    <div
      style={{
        width: px,
        height: px,
        background: bg,
        borderRadius: (radiusPct / 100) * px,
        boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={px * 0.6}
        height={px * 0.6}
        viewBox="0 0 120 120"
        fill="none"
      >
        <circle cx="60" cy="60" r="44" stroke={ring} strokeWidth="11.4" />
        <circle cx="91.1" cy="28.9" r="20" fill={gap} />
        <circle cx="91.1" cy="28.9" r="13" fill={node} />
      </svg>
    </div>
  );
}

export default function BrandSheetPage() {
  return (
    <div style={styles.page}>
      <div style={styles.sheet}>
        {/* HERO */}
        <div style={styles.hero}>
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 12,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: C.accent,
            }}
          >
            Brand mark · Orbit
          </div>
          <h1
            className={spaceGrotesk.className}
            style={{
              fontWeight: 700,
              fontSize: 46,
              letterSpacing: "-0.02em",
              margin: "14px 0 0",
            }}
          >
            BGS
          </h1>
          <p
            style={{
              maxWidth: 440,
              color: "#bdb6ab",
              fontSize: 15,
              lineHeight: 1.6,
              margin: "14px 0 0",
            }}
          >
            Систем, сүлжээ, тэлэлтийг илэрхийлсэн цагираг тэмдэг. Нэг тогтвортой
            бүтэц, нэг хөдөлгөөнт зангилаа.
          </p>
          <div
            style={{
              position: "absolute",
              right: -40,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.96,
            }}
          >
            <OrbitMark
              size={300}
              variant="reversed"
              background={C.ink}
              className="hero-mark"
            />
            {/* Override ring color to subtle */}
            <style>{`.hero-mark circle:first-child{stroke:#2c2822 !important}`}</style>
          </div>
        </div>

        {/* 01 THE MARK */}
        <section style={styles.section}>
          <SectionHead
            num="01"
            title="Тэмдэг"
            sub="Цагираг = тогтвортой систем. Улбар шар зангилаа = хөдөлгөөн, тэлэлт, хүн төвт чанар."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 18,
            }}
          >
            <div style={{ ...styles.tile, aspectRatio: 1 }}>
              <OrbitMark size={100} variant="primary" background={C.paper} />
              <span style={styles.lbl}>primary</span>
            </div>
            <div
              style={{
                ...styles.tile,
                aspectRatio: 1,
                background: C.ink,
                borderColor: "#2c2822",
              }}
            >
              <OrbitMark size={100} variant="reversed" background={C.ink} />
              <span style={styles.lblOnDark}>reversed</span>
            </div>
            <div
              style={{
                ...styles.tile,
                aspectRatio: 1,
                background: C.accent,
                borderColor: "#E25C00",
              }}
            >
              <OrbitMark size={100} variant="accent" background={C.accent} />
              <span style={styles.lblOnDark}>accent</span>
            </div>
            <div
              style={{ ...styles.tile, aspectRatio: 1, background: C.paper2 }}
            >
              <OrbitMark size={100} variant="mono" background={C.paper2} />
              <span style={styles.lbl}>mono</span>
            </div>
          </div>
        </section>

        {/* 02 CONSTRUCTION */}
        <section style={styles.section}>
          <SectionHead
            num="02"
            title="Бүтэц ба чөлөөт зай"
            sub="Тэмдгийн өндрийн 1/2-тэй тэнцэх хэмжээний чөлөөт зай үргэлж үлдээнэ. Хамгийн бага хэмжээ: 20px."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
            }}
          >
            <div style={{ ...styles.tile, aspectRatio: 1.3 }}>
              <ConstructionGrid />
              <span style={styles.lbl}>grid</span>
            </div>
            <div
              style={{ ...styles.tile, aspectRatio: 1.3, background: C.paper2 }}
            >
              <ClearspaceGuide />
              <span style={styles.lbl}>clearspace</span>
            </div>
          </div>
        </section>

        {/* 03 LOCKUPS */}
        <section style={styles.section}>
          <SectionHead
            num="03"
            title="Lockup хувилбарууд"
            sub="Хэвтээ нь үндсэн. Босоо нь нарийн талбайд. Тэмдэг ганцаараа апп/favicon-д."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 22,
            }}
          >
            <div style={{ ...styles.tile, aspectRatio: 1.1 }}>
              <BgsLockup kind="horizontal" background={C.paper} />
              <span style={styles.lbl}>horizontal</span>
            </div>
            <div style={{ ...styles.tile, aspectRatio: 1.1 }}>
              <BgsLockup kind="stacked" background={C.paper} />
              <span style={styles.lbl}>stacked</span>
            </div>
            <div style={{ ...styles.tile, aspectRatio: 1.1 }}>
              <BgsLockup kind="with-tagline" background={C.paper} />
              <span style={styles.lbl}>with tagline</span>
            </div>
          </div>
        </section>

        {/* 04 COLOR */}
        <section style={styles.section}>
          <SectionHead
            num="04"
            title="Өнгөний систем"
            sub="Улбар шар нь зөвхөн өргөлт. Бэх хар, цаасан өнгө дэвсгэр бүрдүүлнэ."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              border: "1px solid #E3DDD2",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {SWATCHES.map((s, idx) => (
              <div
                key={s.hex}
                style={{
                  padding: "22px 16px 16px",
                  minHeight: 150,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  background: s.bg,
                  color: s.fg,
                  borderLeft:
                    idx === SWATCHES.length - 1 ? "1px solid #E3DDD2" : "none",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13 }}>{s.name}</span>
                <span
                  className={jetbrainsMono.className}
                  style={{ fontSize: 11, opacity: 0.8, marginTop: 3 }}
                >
                  {s.hex}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 05 TYPOGRAPHY */}
        <section style={styles.section}>
          <SectionHead
            num="05"
            title="Үсгийн сан"
            sub="Space Grotesk — лого ба гарчиг. Manrope — бичвэр. JetBrains Mono — техник тэмдэглэл."
          />
          {[
            {
              meta: "Space Grotesk · 700",
              content: (
                <span
                  className={spaceGrotesk.className}
                  style={{
                    fontSize: 38,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  BGS Систем технологи
                </span>
              ),
            },
            {
              meta: "Manrope · 600",
              content: (
                <span style={{ fontSize: 24, fontWeight: 600 }}>
                  Найдвартай шийдэл, тогтвортой өсөлт
                </span>
              ),
            },
            {
              meta: "Manrope · 400",
              content: (
                <span style={{ fontSize: 16, color: "#3a352e" }}>
                  Бид системийг хүн төвтэйгөөр зохион бүтээдэг.
                </span>
              ),
            },
            {
              meta: "JetBrains Mono · 500",
              content: (
                <span
                  className={jetbrainsMono.className}
                  style={{ fontSize: 14, color: "#8a8276" }}
                >
                  info@bgs.mn · +976 7000 0000
                </span>
              ),
            },
          ].map((row, i, arr) => (
            <div
              key={row.meta}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 20,
                padding: "16px 0",
                borderBottom:
                  i === arr.length - 1 ? "none" : "1px solid #E3DDD2",
              }}
            >
              <span
                className={jetbrainsMono.className}
                style={{
                  fontSize: 11,
                  color: "#8a8276",
                  width: 160,
                  flexShrink: 0,
                }}
              >
                {row.meta}
              </span>
              {row.content}
            </div>
          ))}
        </section>

        {/* 06 IN CONTEXT */}
        <section style={styles.section}>
          <SectionHead
            num="06"
            title="Хэрэглээ"
            sub="Апп icon, вэб толгой, бизнес карт."
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
              marginBottom: 22,
            }}
          >
            <AppIcon
              px={84}
              radiusPct={22.5}
              bg={C.ink}
              ring={C.paper}
              node={C.accent}
              gap={C.ink}
            />
            <AppIcon
              px={84}
              radiusPct={22.5}
              bg={C.accent}
              ring="#fff"
              node={C.ink}
              gap={C.accent}
            />
            <AppIcon
              px={84}
              radiusPct={50}
              bg={C.ink}
              ring={C.paper}
              node={C.accent}
              gap={C.ink}
            />
            <AppIcon
              px={56}
              radiusPct={22.5}
              bg={C.ink}
              ring={C.paper}
              node={C.accent}
              gap={C.ink}
            />
            <AppIcon
              px={40}
              radiusPct={22.5}
              bg={C.ink}
              ring={C.paper}
              node={C.accent}
              gap={C.ink}
            />
            <AppIcon
              px={28}
              radiusPct={22.5}
              bg={C.ink}
              ring={C.paper}
              node={C.accent}
              gap={C.ink}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 22,
            }}
          >
            {/* Web header mockup */}
            <div
              style={{
                ...styles.tile,
                aspectRatio: 1.9,
                padding: 0,
                overflow: "hidden",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  width: "100%",
                  background: C.paper,
                }}
              >
                <div
                  style={{
                    height: 26,
                    background: "#E8E2D8",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "0 12px",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#E8543F",
                    }}
                  />
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#F0A92B",
                    }}
                  />
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: "#37B26B",
                    }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 24,
                    padding: "0 24px",
                  }}
                >
                  <BgsLockup
                    kind="horizontal"
                    markSize={26}
                    wordSize={20}
                    background={C.paper}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      fontWeight: 600,
                      fontSize: 11,
                      color: C.ink,
                    }}
                  >
                    <span>Үйлчилгээ</span>
                    <span>Шийдэл</span>
                    <span
                      style={{
                        background: C.accent,
                        color: "#fff",
                        padding: "7px 13px",
                        borderRadius: 7,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Холбоо барих
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Business card */}
            <div
              style={{
                ...styles.tile,
                aspectRatio: 1.9,
                padding: 0,
                overflow: "hidden",
                alignItems: "stretch",
                background: C.ink,
                borderColor: "#2c2822",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  height: "100%",
                  width: "100%",
                  padding: "26px 28px",
                  background: C.ink,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 13 }}
                >
                  <AppIcon
                    px={46}
                    radiusPct={(11 / 46) * 100}
                    bg={C.accent}
                    ring="#fff"
                    node={C.ink}
                    gap={C.accent}
                  />
                  <BgsWordmark size={26} color={C.paper} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      lineHeight: 1.7,
                      color: "#cfc8bc",
                    }}
                  >
                    <div
                      style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}
                    >
                      Бат-Эрдэнэ Д.
                    </div>
                    <div>Гүйцэтгэх захирал</div>
                    <div
                      className={jetbrainsMono.className}
                      style={{ marginTop: 7, color: C.accent }}
                    >
                      info@bgs.mn
                    </div>
                  </div>
                  <span
                    className={manrope.className}
                    style={{
                      fontSize: 7.5,
                      fontWeight: 600,
                      letterSpacing: "0.34em",
                      textTransform: "uppercase",
                      color: "#6f685e",
                    }}
                  >
                    Систем технологи
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 07 EXPORTS */}
        <section style={styles.section}>
          <SectionHead
            num="07"
            title="Татаж авах"
            sub="Цэвэр SVG векторууд. Хэмжээ алдагдахгүй, хаана ч хэрэглэх боломжтой."
          />
          <BrandDownloads />
        </section>

        <div
          style={{
            padding: "34px 60px",
            color: "#8a8276",
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #E3DDD2",
          }}
        >
          <span
            className={manrope.className}
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.34em",
              textTransform: "uppercase",
            }}
          >
            BGS · Систем технологи
          </span>
          <span
            className={jetbrainsMono.className}
            style={{ fontSize: 12 }}
          >
            Orbit mark · v1 · 2026
          </span>
        </div>
      </div>
    </div>
  );
}
