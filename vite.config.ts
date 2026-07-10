import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-192x192.svg", "pwa-512x512.svg"],
      manifest: {
        name: "HRCube",
        short_name: "HRCube",
        description: "Aplikasi Manajemen Data Pegawai",
        theme_color: "#f8fafc",
        background_color: "#f8fafc",
        icons: [
          { src: "pwa-192x192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "pwa-512x512.svg", sizes: "512x512", type: "image/svg+xml" },
          {
            src: "pwa-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Keep precache lean — large app chunks load on demand via code-split
        maximumFileSizeToCacheInBytes: 2_500_000,
        globPatterns: ["**/*.{js,css,html,svg,ico,webp,woff2}"],
        // Never treat /api/* as SPA navigation (was serving login HTML for /api/health)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    target: "es2022",
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("xlsx")) return "xlsx";
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("motion") || id.includes("framer-motion")) return "motion";
          if (id.includes("react-dom") || id.includes("react-router") || id.includes("/react/")) {
            return "react-vendor";
          }
          if (id.includes("@radix-ui") || id.includes("sonner") || id.includes("lucide")) {
            return "ui-vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
