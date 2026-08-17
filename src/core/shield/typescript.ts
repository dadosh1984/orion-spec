// ponytail: rung-2 — extraction from handler.ts, no new behavior
// ponytail: rung-4 — reuses existing project context

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type ShieldAdapter, type GuardCommand } from "./adapter.js";

function detectPackageManager(cwd: string): "pnpm" | "yarn" | "npm" {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function hasScript(name: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts?: Record<string, unknown>;
    };
    return typeof pkg.scripts?.[name] === "string";
  } catch {
    return false;
  }
}

function stepCommand(step: "lint" | "type" | "test"): string | null {
  const pm = detectPackageManager(process.cwd());
  const run = (name: string) =>
    pm === "npm" ? `npm run ${name}` : `${pm} run ${name}`;
  switch (step) {
    case "lint":
      return hasScript("lint") ? run("lint") : null;
    case "type":
      if (hasScript("typecheck")) return run("typecheck");
      if (hasScript("type-check")) return run("type-check");
      return `${pm} exec tsc --noEmit`;
    case "test":
      return hasScript("test")
        ? pm === "npm"
          ? "npm test"
          : `${pm} test`
        : null;
  }
}

function cmdFromString(s: string | null): GuardCommand | null {
  if (!s) return null;
  const parts = s.split(/\s+/);
  return { cmd: parts[0], args: parts.slice(1) };
}

function collectExports(source: string, out: Set<string>): void {
  const decl =
    /\bexport\s+(?:declare\s+)?(?:const|function|class|interface|type|enum|let|var)\s+([A-Za-z0-9_$]+)/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(source))) out.add(m[1]);
  const list = /\bexport\s*\{([^}]*)\}/g;
  while ((m = list.exec(source))) {
    for (const part of m[1].split(",")) {
      const alias = part.trim().match(/as\s+"([^"]+)"\s*$/);
      if (alias) {
        out.add(alias[1]);
        continue;
      }
      const name = part
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name && /^[A-Za-z0-9_$]+$/.test(name)) out.add(name);
    }
  }
}

export const TypeScriptAdapter: ShieldAdapter = {
  id: "typescript",

  detect(cwd: string): boolean {
    return existsSync(join(cwd, "package.json"));
  },

  getLintCommand(): GuardCommand | null {
    return cmdFromString(stepCommand("lint"));
  },

  getTypeCheckCommand(): GuardCommand | null {
    return cmdFromString(stepCommand("type"));
  },

  getTestCommand(): GuardCommand | null {
    return cmdFromString(stepCommand("test"));
  },

  extractApi(files: string[]): string[] {
    const exports = new Set<string>();
    for (const f of files) {
      try {
        collectExports(readFileSync(f, "utf8"), exports);
      } catch {
        // skip unreadable
      }
    }
    return [...exports];
  },

  getSecurityPatterns() {
    return [
      { re: /\beval\s*\(/, label: "eval()" },
      { re: /\bnew\s+Function\s*\(/, label: "new Function()" },
      { re: /process\.env\./, label: "process.env.*" },
      { re: /\bchild_process\b/, label: "child_process usage" },
      {
        re: /(?:exec|execSync|spawnSync|spawn|fork)\s*\([^)]*\$\{/,
        label: "interpolated variable in shell exec",
      },
      {
        re: /(?:exec|execSync|spawnSync)\s*\([^)]*["'`][^"'`]*\$\s*\(/,
        label: "shell command substitution in exec",
      },
      {
        re: /(?:exec|execSync|spawnSync)\s*\([^)]*[|;&]/,
        label: "shell command chaining in exec",
      },
      {
        re: /(?:require\s*\(\s*["'](?:node:)?vm["']\s*\)|from\s*["'](?:node:)?vm["'])/,
        label: "node:vm sandbox escape risk",
      },
      {
        re: /(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["'][^"']{16,}/i,
        label: "hardcoded credential",
      },
      {
        re: /\b(?:API[_-]?KEY|KEY|SECRET|PASSWORD|TOKEN)\b\s*[:=]\s*["'][^"']{16,}/,
        label: "hardcoded credential (UPPERCASE)",
      },
    ];
  },

  fileMetrics(file: string): { loc: number; imports: number } {
    try {
      const code = readFileSync(file, "utf8");
      const loc = code.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      const imports =
        (code.match(/\bimport\b[^;]*/g) ?? []).length +
        (code.match(/\brequire\s*\(/g) ?? []).length;
      return { loc, imports };
    } catch {
      return { loc: 0, imports: 0 };
    }
  },
};
