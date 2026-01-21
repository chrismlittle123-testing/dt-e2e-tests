import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120000, // 2 minutes for e2e tests
    hookTimeout: 60000,
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    sequence: {
      shuffle: false,
    },
  },
});
