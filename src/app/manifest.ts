import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Benefit HQ",
    short_name: "Benefit HQ",
    description: "Build branded benefits renewal decks from census data.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f1",
    theme_color: "#0e1613",
    icons: [
      {
        src: "/icons/benefit-hq-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/benefit-hq-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/benefit-hq-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
