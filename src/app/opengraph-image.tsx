import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#FBFAF7",
          fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
      >
        {/* background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(900px 520px at 20% 20%, rgba(246,215,222,0.50), transparent 60%), radial-gradient(780px 520px at 80% 30%, rgba(207,224,214,0.55), transparent 62%), linear-gradient(120deg, rgba(253,231,160,0.35), rgba(255,255,255,0.0))",
          }}
        />

        {/* card */}
        <div
          style={{
            margin: "64px",
            padding: "56px",
            borderRadius: "48px",
            border: "1px solid rgba(28,27,24,0.10)",
            background: "rgba(255,255,255,0.72)",
            boxShadow: "0 24px 70px rgba(18,16,12,0.14)",
            display: "flex",
            gap: "40px",
            alignItems: "center",
            width: "calc(100% - 128px)",
          }}
        >
          {/* mascot */}
          <div
            style={{
              width: 164,
              height: 164,
              borderRadius: 44,
              background:
                "linear-gradient(135deg, rgba(246,215,222,0.65), rgba(253,231,160,0.50))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(28,27,24,0.08)",
            }}
          >
            <svg width="120" height="120" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="hat" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#ffffff" stopOpacity="0.98" />
                  <stop offset="1" stopColor="#f2efe8" stopOpacity="0.98" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="30" fill="rgba(246,215,222,0.35)" />
              <path
                d="M20 22c0-5 4.8-9 12-9s12 4 12 9c3.5.6 6 3.1 6 6.3 0 3.9-3.5 7-8 7H22c-4.5 0-8-3.1-8-7 0-3.2 2.5-5.7 6-6.3Z"
                fill="url(#hat)"
                stroke="rgba(28,27,24,0.16)"
                strokeWidth="1"
              />
              <path
                d="M20 36c2.8-2.7 7.1-4.6 12-4.6S41.2 33.3 44 36v7.3c0 8-5.4 14.7-12 14.7S20 51.3 20 43.3V36Z"
                fill="#fff"
                opacity="0.94"
                stroke="rgba(28,27,24,0.14)"
                strokeWidth="1"
              />
              <circle cx="27.5" cy="43" r="1.6" fill="rgba(28,27,24,0.72)" />
              <circle cx="36.5" cy="43" r="1.6" fill="rgba(28,27,24,0.72)" />
              <path
                d="M28 48c1.4 1.6 3 2.4 4 2.4s2.6-.8 4-2.4"
                stroke="rgba(28,27,24,0.55)"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>

          {/* text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: -1.2, color: "#1C1B18" }}>
              Dessert Dream Baker
            </div>
            <div style={{ fontSize: 26, color: "rgba(28,27,24,0.72)", maxWidth: 720 }}>
              Your hands-free AI pastry chef — calm guidance, dramatic timers, and dessert-only genius.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              {["Voice-first", "Scribe STT", "Agents", "Sound effects"].map((t) => (
                <div
                  key={t}
                  style={{
                    fontSize: 18,
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(28,27,24,0.10)",
                    background: "rgba(255,255,255,0.65)",
                    color: "rgba(28,27,24,0.78)",
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

