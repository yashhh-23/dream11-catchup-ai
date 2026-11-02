import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { sanitizeMood, sanitizeOversText } from "@/lib/matchUtils";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawOvers = sanitizeOversText(searchParams.get("overs"));
    const mood = sanitizeMood(searchParams.get("mood"));
    const rawMatch = (searchParams.get("match") || "India vs Pakistan").slice(0, 60).replace(/[<>{}]/g, "");
    const match = rawMatch.includes("India") ? "India vs Pakistan, ICC Men's T20 World Cup" : "Dream11 T20 Match Center";
    const oversText = `Caught up on ${rawOvers}`;

    // Resolve domain dynamically from request headers or environment variables
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ||
      (process.env.VERCEL_URL ? process.env.VERCEL_URL : null) ||
      "dream11.com";
    const displayDomain = host.replace(/:\d+$/, "");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: "#0D1117",
            padding: "60px 80px",
            fontFamily: "system-ui, sans-serif",
            border: "12px solid #E11D48",
          }}
        >
          {/* Top Brand Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "12px",
                  backgroundColor: "#E11D48",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: "28px",
                  fontWeight: "bold",
                }}
              >
                D
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "800",
                  color: "#FFFFFF",
                  letterSpacing: "-0.5px",
                }}
              >
                Dream11 CatchUp AI
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#161B22",
                border: "1px solid #30363D",
                padding: "8px 20px",
                borderRadius: "999px",
                color: "#10B981",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              ● Zero-Spoiler Recap
            </div>
          </div>

          {/* Main Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div
              style={{
                fontSize: "24px",
                color: "#8B949E",
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontWeight: "600",
              }}
            >
              {match}
            </div>

            <div
              style={{
                fontSize: "56px",
                fontWeight: "900",
                color: "#F0F6FC",
                lineHeight: "1.1",
              }}
            >
              {oversText}
            </div>

            <div
              style={{
                display: "flex",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  backgroundColor: "#21262D",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  color: "#E6EDF3",
                  fontSize: "22px",
                  fontWeight: "600",
                }}
              >
                Mood · {mood}
              </div>
              <div
                style={{
                  color: "#E11D48",
                  fontSize: "22px",
                  fontWeight: "700",
                }}
              >
                Zero scores spoiled. Ready for live action!
              </div>
            </div>
          </div>

          {/* Bottom Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              paddingTop: "24px",
              borderTop: "1px solid #21262D",
              color: "#6E7681",
              fontSize: "18px",
            }}
          >
            <div>Rejoin live match in 45 seconds · {displayDomain}</div>
            <div style={{ color: "#8B949E", fontWeight: "600" }}>Don&apos;t tell me the score — I&apos;m watching live!</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error("Failed to generate share card:", e?.message || e);
    return new Response("Failed to generate image", { status: 500 });
  }
}
