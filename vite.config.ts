import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app can be dropped into any subfolder of a static site.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
  },
});