import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { proxy: { "/api": "http://127.0.0.1:8888" } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("konva")) return "stage-canvas";
          if (id.includes("xyflow") || id.includes("d3-")) return "patch-graph";
          return "vendor";
        },
      },
    },
  },
});
