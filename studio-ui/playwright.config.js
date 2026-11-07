import { defineConfig } from "@playwright/test";
const baseURL = process.env.PROTOTYPE_URL || "http://127.0.0.1:5187";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: {
    baseURL,
    channel: process.env.CI ? undefined : "msedge",
    viewport: { width: 1600, height: 1050 },
  },
  webServer: {
    command: "npm run dev -- --port 5187 --strictPort",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
