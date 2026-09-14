import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Atletas Energisa",
    short_name: "Atletas",
    description: "Portal do programa Atletas Energisa",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f4f8",
    theme_color: "#009bc1",
    lang: "pt-BR",
    orientation: "portrait-primary",
    categories: ["sports", "health", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
