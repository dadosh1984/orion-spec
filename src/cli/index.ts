#!/usr/bin/env node
/**
 * Orion CLI entry point.
 *
 * Usage:
 *   orion <command> [args...] [flags...]
 *
 * Run `orion help` for the full command list.
 */
import { main } from "./commands.js";

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code ?? 0;
  })
  .catch((err: unknown) => {
    console.error(
      `orion: fatal: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  });
