import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["system-logo.jpg", "system-logo.png", "ghana-coat-of-arms.png"],
      manifest: {
        name: "PWD Support Management System",
        short_name: "PWD Support",
        description: "Municipal disability support register — shared database for welfare staff.",
        theme_color: "#12345A",
        background_color: "#f4f7fa",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/system-logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,jpg,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-webfonts" },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
