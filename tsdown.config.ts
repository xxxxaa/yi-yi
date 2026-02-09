import { defineConfig } from "tsdown";

const env = {
  NODE_ENV: "production",
};

export default defineConfig([
  {
    entry: "src/cli/entry.ts",
    outDir: "dist/cli",
    env,
    fixedExtension: true,
    platform: "node",
  },
  {
    entry: "src/gateway/server.ts",
    outDir: "dist/gateway",
    env,
    fixedExtension: true,
    platform: "node",
  },
]);
