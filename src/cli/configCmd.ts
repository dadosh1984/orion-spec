import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolveConfig } from "../utils/file.js";
import { statusMark } from "../utils/term.js";

/**
 * `orion config [show|set <key> <value>]` (v0.37) — view or edit the
 * project-local Orion configuration (orionTdd.json / orionTrack.json).
 * Without arguments it prints a summary; `show` prints the full file.
 */

type ConfigFile = "tdd" | "track";

function resolveConfigFile(name: ConfigFile): string {
  return name === "tdd"
    ? resolveConfig("orionTdd.json")
    : resolveConfig("orionTrack.json");
}

function readConfig(name: ConfigFile): Record<string, unknown> | null {
  const path = resolveConfigFile(name);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function configCmd(
  args: string[],
): { ok: boolean; text: string } {
  const [sub, file, key, ...rest] = args;
  const value = rest.join(" ");

  if (!sub || sub === "show") {
    const target = (file ?? "tdd") as ConfigFile;
    if (target !== "tdd" && target !== "track") {
      return {
        ok: false,
        text: `${statusMark("error")} unknown config: ${target} (expected: tdd | track)`,
      };
    }
    const cfg = readConfig(target);
    if (!cfg) {
      return {
        ok: false,
        text: `${statusMark("error")} config file not found: ${resolveConfigFile(target)}`,
      };
    }
    return {
      ok: true,
      text: [
        `${statusMark("info")} Config: ${resolveConfigFile(target)}`,
        "",
        ...Object.entries(cfg).map(
          ([k, v]) =>
            `  ${k}: ${typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v)}`,
        ),
        "",
        "Edit with: orion config set tdd <key> <value>",
      ].join("\n"),
    };
  }

  if (sub === "set") {
    if (!file || !key || !value) {
      return {
        ok: false,
        text: `${statusMark("error")} usage: orion config set tdd|track <key> <value>`,
      };
    }
    const target = file as ConfigFile;
    if (target !== "tdd" && target !== "track") {
      return {
        ok: false,
        text: `${statusMark("error")} unknown config: ${target} (expected: tdd | track)`,
      };
    }
    const path = resolveConfigFile(target);
    const cfg = readConfig(target) ?? {};
    // Try to preserve the value type: number, bool, or string.
    let parsed: unknown = value;
    if (value === "true") parsed = true;
    else if (value === "false") parsed = false;
    else if (/^-?\d+(\.\d+)?$/.test(value)) parsed = Number(value);
    cfg[key] = parsed;
    writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    return {
      ok: true,
      text: `${statusMark("done")} ${target}.${key} = ${JSON.stringify(parsed)}`,
    };
  }

  // No subcommand — print summary of all config files.
  const lines = [`${statusMark("info")} Orion configuration:`];
  for (const name of ["tdd", "track"] as ConfigFile[]) {
    const cfg = readConfig(name);
    const path = resolveConfigFile(name);
    lines.push(
      cfg
        ? `  ${name}: ${path} (${Object.keys(cfg).length} keys)`
        : `  ${name}: ${path} (missing)`,
    );
    if (cfg) {
      for (const [k, v] of Object.entries(cfg)) {
        lines.push(`    ${k}: ${JSON.stringify(v)}`);
      }
    }
  }
  return { ok: true, text: lines.join("\n") };
}
