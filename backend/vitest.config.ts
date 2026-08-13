import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Integration tests share one real Postgres database and must not run
    // concurrently against it — they'd trip over each other's fixture data.
    fileParallelism: false,
  },
});
