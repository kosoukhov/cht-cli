import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/cht.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
});
