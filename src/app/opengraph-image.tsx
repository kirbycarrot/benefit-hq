import { ImageResponse } from "next/og";

export const alt = "Benefit HQ — branded benefits renewal decks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#0e1613",
          color: "#ffffff",
          padding: "76px 88px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: 190,
            height: 190,
            borderRadius: 48,
            background: "#2fe0d2",
            color: "#0e1613",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 76,
            fontWeight: 900,
            letterSpacing: "-7px",
            marginRight: 58,
          }}
        >
          BH
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
          <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: "-3px" }}>
            Benefit HQ
          </div>
          <div
            style={{
              color: "#b9c4c1",
              fontSize: 34,
              lineHeight: 1.35,
              marginTop: 20,
            }}
          >
            Build polished, branded benefits renewal presentations from census data.
          </div>
        </div>
      </div>
    ),
    size
  );
}
