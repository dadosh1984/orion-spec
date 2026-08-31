# ponytail: 2 add only the minimal file layout for the new CLI
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.cwd();
for (const dir of ["src/cli", "src/core", "tests"]) {
  mkdirSync(join(base, dir), { recursive: true });
}
