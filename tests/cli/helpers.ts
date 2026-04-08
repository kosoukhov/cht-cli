import path from "node:path";
import fs from "node:fs";

const DIST_PATH = path.resolve("dist/cht.js");
const SRC_PATH = path.resolve("bin/cht.ts");

const useBuilt = fs.existsSync(DIST_PATH);

/** Returns [executable, ...prefixArgs] to invoke the CLI binary. */
export function chtExecArgs(): [string, string[]] {
  if (useBuilt) {
    return ["node", [DIST_PATH]];
  }
  return ["node", ["--experimental-strip-types", SRC_PATH]];
}
