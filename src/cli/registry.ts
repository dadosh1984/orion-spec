/**
 * CLI command registry (v0.51).
 *
 * Single source of truth for Orion's top-level commands. Replaces the
 * old `commands-list.ts` and the giant switch in `commands.ts:main()`.
 *
 * Adding a new top-level command = 1 entry in ORION_REGISTRY + 1 file
 * in `src/cli/commands/<name>.ts` that exports a `CommandHandler`.
 */
import type { CliOptions } from "./helpers.js";

/** A command handler receives the post-parse args and global flags. */
export type CommandHandler = (
  args: string[],
  opts: CliOptions,
) => Promise<number> | number;

/** Public description of one top-level command (for --help). */
export interface CommandSpec {
  /** Canonical name (e.g. "new", "ls"). */
  name: string;
  /** Short description printed in `orion --help`. */
  description: string;
  /** The handler that implements the command. */
  handler: CommandHandler;
  /** Deprecated top-level aliases that resolve to this command. */
  aliases?: string[];
}

/**
 * The 8 top-level commands that make up Orion v0.51+ (variant B).
 *
 * Pipeline: new, ls, change, run, scale, doctor, serve, plugin.
 */
export const ORION_REGISTRY: Map<string, CommandSpec> = new Map();

/** Register a command. Throws on duplicate name or alias. */
export function registerCommand(spec: CommandSpec): void {
  if (ORION_REGISTRY.has(spec.name)) {
    throw new Error(`Duplicate command name: ${spec.name}`);
  }
  for (const alias of spec.aliases ?? []) {
    if (ORION_REGISTRY.has(alias)) {
      throw new Error(`Alias '${alias}' clashes with a command name`);
    }
  }
  ORION_REGISTRY.set(spec.name, spec);
}

/** Resolve an alias to its canonical name, or return the input if none. */
export function canonicalize(name: string): string {
  for (const spec of ORION_REGISTRY.values()) {
    if (spec.aliases?.includes(name)) return spec.name;
  }
  return name;
}
