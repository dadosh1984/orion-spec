#!/usr/bin/env node
/**
 * Orion CLI entry point.
 *
 * Usage:
 *   orion <command> [args...] [flags...]
 *
 * Run `orion help` for the full command list.
 *
 * Activity indicator (v0.18, L): every direct CLI run announces itself on
 * stderr with the same vocabulary the MCP indicator has used since v0.8 —
 * `⚙ orion:<cmd> …` at start, `✅ orion:<cmd> done` / `❌ orion:<cmd>
 * failed — <reason>` at exit — so the user always sees when Orion is the
 * one working in the terminal. stdout stays untouched for scripting; the
 * marker is skipped where it would corrupt protocol or machine output
 * (`mcp`, `help`, and any `--json` invocation).
 */
import { main } from "./commands.js";

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "";
const rest = argv.slice(1).join(" ");
const machine =
  cmd === "mcp" ||
  cmd === "help" ||
  cmd === "--help" ||
  cmd === "-h" ||
  cmd === "version" ||
  cmd === "--version" ||
  argv.includes("--json");

function announce(line: string): void {
  process.stderr.write(line + "\n");
}

function run(): Promise<void> {
  if (!machine) {
    announce(`⚙ orion:${cmd}${rest ? " " + rest : ""}`);
  }
  return main(argv)
    .then((code) => {
      if (!machine) {
        announce(
          code === 0
            ? `✅ orion:${cmd} done`
            : `❌ orion:${cmd} failed — exit code ${code}`,
        );
      }
      process.exitCode = code ?? 0;
    })
    .catch((err: unknown) => {
      if (!machine) {
        announce(
          `❌ orion:${cmd} failed — ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      console.error(
        `orion: fatal: ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exitCode = 1;
    });
}

void run();
