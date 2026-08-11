/** Shared CLI helpers used by the dispatcher and sub-command modules. */
import { statusMark } from "../utils/term.js";

/** Global CLI flags shared by every command. */
export interface CliOptions {
  noCache: boolean;
  dry: boolean;
  watch: boolean;
  json: boolean;
  /** Probe the npm registry for guard-prompt candidates (v0.22). */
  npm: boolean;
  /** Port for `serve` (default 4780). */
  port: number;
  /** Serve the HTML dashboard at `/` (`serve --ui`). */
  ui: boolean;
  /** Bind host for `serve` (default 127.0.0.1). */
  host?: string;
  /** Session file for `metrics --session <path>` (v0.15). */
  session?: string;
  /** Parallel wave size for `forge --parallel <n>` (v0.16). */
  parallel?: number;
  /** Bearer token for `serve` (v0.19); auto-generated on non-loopback bind. */
  token?: string;
  /** Template language override for `draft` (v0.27): "en" | "ru". */
  lang?: "en" | "ru";
  /** Save forge result as a runnable script (v0.39). */
  saveAs?: string;
}

/** Print JSON or plain text depending on the --json flag. */
export function printOut(opts: CliOptions, obj: unknown, plain: string): void {
  if (opts.json) {
    console.log(JSON.stringify(obj, null, 2));
  } else {
    console.log(plain);
  }
}

/** Print an error to stderr and return a non-zero exit code. */
export function fail(message: string): number {
  console.error(`orion: ${statusMark("error")} ${message}`);
  return 1;
}

/**
 * Minimal line-level diff for the `scale --dry` preview.
 * Produces `+`/`-` prefixed lines; unchanged lines are omitted.
 */
export function lineDiff(before: string, after: string): string[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      if (a[i] !== undefined) out.push(`- ${a[i]}`);
      if (b[i] !== undefined) out.push(`+ ${b[i]}`);
    }
  }
  return out;
}
