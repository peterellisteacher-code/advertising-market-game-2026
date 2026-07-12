import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["web/src/**/*.test.ts", "netlify/functions/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true
  }
});
