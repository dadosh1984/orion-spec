import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * YAGNI stage 5 — dep.
 * Ensures every module imported by `code` that is missing from
 * `package.json` gets added to devDependencies. Records the missing
 * packages so the caller can run `pnpm install` afterwards.
 */
export interface DepResult {
  code: string;
  missing: string[];
}

export function handler(code: string): string | DepResult {
  const pkgPath = resolve("package.json");
  let missing = findMissingDeps(code);

  // Drop packages that are already declared — they are not missing.
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    missing = missing.filter((d) => !declared.has(d));
  } catch {
    /* no package.json — nothing is declared */
  }

  if (missing.length === 0) return code;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const dev = pkg.devDependencies ?? (pkg.devDependencies = {});
    for (const dep of missing) {
      if (!pkg.dependencies?.[dep] && !dev[dep]) dev[dep] = "*";
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  } catch {
    /* package.json unreadable — return the list anyway */
  }
  return { code, missing };
}

/** Extract external package names from import/require statements. */
function findMissingDeps(code: string): string[] {
  const re = /(?:from|import\s*\(|require\()\s*['"]((?:@[\w-]+\/)?[\w-]+)['"]/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const dep = m[1];
    if (
      !dep.startsWith("node:") &&
      !dep.startsWith(".") &&
      !dep.startsWith("/")
    ) {
      seen.add(dep);
    }
  }
  return [...seen];
}
