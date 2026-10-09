import { ImageResponse } from "next/og";

/** Link previews (Slack, Teams, LinkedIn…) all use one 1200 × 630 card, in the light theme's colours. */
export const OG_SIZE = { width: 1200, height: 630 };

const COLORS = { background: "#f7f7f8", foreground: "#18181b", muted: "#5f5f6b", accent: "#4f46e5", border: "#e4e4e7" };

export type OgStat = { label: string; value: string };

/** The card: the Sprintwise mark, a small label, a large title, and up to four numbers. */
export function ogCard({ eyebrow, title, subtitle, stats = [] }: { eyebrow: string; title: string; subtitle?: string; stats?: OgStat[] }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: `linear-gradient(135deg, ${COLORS.background} 55%, #e0e7ff 100%)`,
          color: COLORS.foreground,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 24 24">
            <rect width="24" height="24" rx="7" fill={COLORS.accent} />
            <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
            <path d="M6.5 15.5a5.5 5.5 0 0 1 8.4-4.7" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="15.5" r="1.4" fill="#ffffff" />
          </svg>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Sprintwise</div>
          <div style={{ marginLeft: 12, fontSize: 26, color: COLORS.muted }}>{eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: title.length > 48 ? 56 : 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 30, color: COLORS.muted, lineHeight: 1.35 }}>{subtitle}</div>}
        </div>

        <div style={{ display: "flex", gap: 20, minHeight: 120 }}>
          {stats.slice(0, 4).map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "18px 24px",
                borderRadius: 20,
                background: "#ffffff",
                border: `2px solid ${COLORS.border}`,
              }}
            >
              <div style={{ fontSize: 24, color: COLORS.muted }}>{s.label}</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.accent }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
