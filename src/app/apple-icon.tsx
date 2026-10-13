import { ImageResponse } from "next/og";

/** The icon an iPhone or iPad shows when Sprintwise is added to the home screen: the gauge mark on the accent colour. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#4f46e5" }}>
        <svg width="132" height="132" viewBox="0 0 24 24">
          <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
          <path d="M6.5 15.5a5.5 5.5 0 0 1 8.4-4.7" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="15.5" r="1.4" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
