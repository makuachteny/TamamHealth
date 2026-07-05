import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: "#10195A",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 44 }}>
          <div style={{ display: "flex", width: 40, height: 40 }}>
            <svg width="40" height="40" viewBox="0 0 63.42 63.4">
              <g fill="#2191D0">
                <circle cx="7.59" cy="44.45" r="1.79" />
                <circle cx="7.59" cy="37.37" r="2.9" />
                <circle cx="7.59" cy="26.01" r="4.69" />
                <circle cx="7.59" cy="7.59" r="7.59" />
                <circle cx="26.06" cy="11.25" r="7.59" />
                <circle cx="41.7" cy="21.72" r="7.59" />
                <circle cx="52.17" cy="37.4" r="7.59" />
                <circle cx="55.84" cy="55.82" r="7.59" />
                <circle cx="19.01" cy="28.28" r="4.69" />
                <circle cx="28.68" cy="34.75" r="4.69" />
                <circle cx="35.15" cy="44.43" r="4.69" />
                <circle cx="37.42" cy="55.82" r="4.69" />
                <circle cx="14.65" cy="38.81" r="2.9" />
                <circle cx="20.62" cy="42.81" r="2.9" />
                <circle cx="24.62" cy="48.79" r="2.9" />
                <circle cx="26.06" cy="55.83" r="2.9" />
                <circle cx="11.95" cy="45.32" r="1.79" />
                <circle cx="15.63" cy="47.79" r="1.79" />
                <circle cx="18.11" cy="51.48" r="1.79" />
                <circle cx="18.97" cy="55.85" r="1.79" />
              </g>
            </svg>
          </div>
          <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>tamam</span>
        </div>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.15, maxWidth: 920 }}>
          No power. No records. No history.
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#C7D8F5", marginTop: 28, maxWidth: 880 }}>
          Tamam brings digital health records that work offline, so care never starts from zero.
        </div>
      </div>
    ),
    { ...size }
  );
}
