import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atletas Energisa",
    short_name: "Atletas",
    description: "Portal do programa Atletas Energisa",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f4f8",
    theme_color: "#009bc1",
    lang: "pt-BR",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-atletas.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-atletas.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
