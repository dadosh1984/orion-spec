// === T7: PythonAdapter ===
// ponytail: rung-3 — Python support requires new adapter
// ponytail: rung-4 — spawnSync external tools, no npm deps

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { ShieldAdapter, GuardCommand } from "./adapter.js";

function hasMarker(cwd: string, files: string[]): boolean {
  return files.some((f) => existsSync(join(cwd, f)));
}

function pyCmd(cmd: string, args: string[]): GuardCommand {
  // Try python3, then python
  const python =
    process.platform === "win32" ? "python" : "python3";
  return {
    cmd: python,
    args: ["-m", cmd, ...args],
    parser: (stdout: string) => {
      const clean = stdout.trim();
      if (clean.length === 0 || clean.startsWith("error:")) {
        return { status: "FAIL", detail: clean.slice(0, 200) };
      }
      return { status: "PASS", detail: clean.slice(0, 200) || "ok" };
    },
  };
}

export const PythonAdapter: ShieldAdapter = {
  id: "python",

  detect(cwd: string): boolean {
    return hasMarker(cwd, [
      "pyproject.toml",
      "setup.py",
      "setup.cfg",
      ".python-version",
      "requirements.txt",
    ]);
  },

  getLintCommand(): GuardCommand | null {
    return hasMarker(process.cwd(), ["pyproject.toml", "setup.cfg"])
      ? pyCmd("ruff", ["check", ".", "--output-format", "json"])
      : null;
  },

  getTypeCheckCommand(): GuardCommand | null {
    return hasMarker(process.cwd(), ["pyproject.toml", "setup.cfg"])
      ? pyCmd("mypy", [".", "--no-error-summary"])
      : { cmd: "mypy", args: [".", "--no-error-summary"] };
  },

  getTestCommand(): GuardCommand | null {
    return hasMarker(process.cwd(), ["pyproject.toml", "setup.cfg"])
      ? pyCmd("pytest", ["-q", "--tb=short"])
      : { cmd: "pytest", args: ["-q", "--tb=short"] };
  },

  extractApi(files: string[]): string[] {
    if (files.length === 0) return [];
    try {
      const script = join(__dirname, "../../../scripts/extract_python_api.py");
      const normalized = join(process.cwd(), script);
      if (!existsSync(normalized)) {
        // Fallback: regex-based extraction
        return files.flatMap((f) => {
          try {
            const code = readFileSync(f, "utf8");
            const symbols: string[] = [];
            const re = /^(?:async\s+)?(?:def|class)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:\(]/gm;
            let m: RegExpExecArray | null;
            while ((m = re.exec(code))) {
              if (!m[1].startsWith("_")) symbols.push(m[1]);
            }
            return symbols;
          } catch {
            return [];
          }
        });
      }
      const result = execSync(
        `python3 ${normalized} ${files.join(" ")}`,
        { encoding: "utf8", timeout: 30_000 },
      );
      return result.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  },

  getSecurityPatterns() {
    return [
      { re: /\beval\s*\(/, label: "eval()" },
      { re: /\bexec\s*\(/, label: "exec()" },
      { re: /\b__import__\s*\(/, label: "dynamic import" },
      { re: /\bcompile\s*\(/, label: "dynamic compile" },
      { re: /\bos\.system\s*\(/, label: "os.system call" },
      { re: /\bsubprocess\.(?:call|run|Popen)\s*\(/, label: "subprocess execution" },
      { re: /shell\s*=\s*True/, label: "subprocess with shell=True" },
      { re: /\bshutil\.rmtree\s*\(/, label: "recursive delete" },
      { re: /\bos\.remove\s*\(/, label: "os.remove" },
      { re: /\bctypes\b/, label: "ctypes FFI" },
      { re: /\bpickle\.loads?\s*\(/, label: "pickle deserialization" },
      { re: /\binput\s*\(/, label: "interactive input" },
    ];
  },

  fileMetrics(file: string): { loc: number; imports: number } {
    try {
      const code = readFileSync(file, "utf8");
      const loc = code.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
      const imports =
        (code.match(/\bimport\b/g) ?? []).length +
        (code.match(/\bfrom\b.*\bimport\b/g) ?? []).length;
      return { loc, imports };
    } catch {
      return { loc: 0, imports: 0 };
    }
  },
};
