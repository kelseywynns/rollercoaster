import { defineConfig } from "vite";
import { localRenderFiles } from "./render-local.js";

export default defineConfig({
  plugins: [localRenderFiles()],
  base: "./",
  build: {
    rollupOptions: {
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
