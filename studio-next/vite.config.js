import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
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
