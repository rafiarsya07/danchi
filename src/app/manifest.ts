import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Danchi",
    short_name: "Danchi",
    description: "A little home for everything: tasks, reminders, money, study, safety and more.",
    lang: "en",
    dir: "ltr",
    scope: "/",
    categories: ["productivity", "lifestyle"],
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8F0",
    theme_color: "#FFE1CF",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "SOS", short_name: "SOS", url: "/safe?sos=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Check in (I'm safe)", url: "/safe", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Daily check", url: "/check", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Add a task", url: "/tasks?new=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Ask Chichi", url: "/ask", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
