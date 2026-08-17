// ponytail: rung-1 — interface needed for adapter pattern
// ponytail: rung-4 — no runtime deps, pure TS types

/**
 * A guard-rail command: an external binary plus its arguments.
 * `cmd` is executed argv-safe (no shell); optional `parser` maps stdout
 * to a PASS/FAIL verdict when the exit code alone is insufficient.
 *
 * @example `{ cmd: "python3", args: ["-m", "ruff", "check", "."] }`
 */
export interface GuardCommand {
  cmd: string;
  args: string[];
  /** Optional stdout parser; default: exit code based */
  parser?: (stdout: string) => { status: "PASS" | "FAIL"; detail: string };
}

/**
 * Language-agnostic guard interface. Each language (TypeScript, Python,
 * Go, ...) implements one adapter; `shield` picks the best match for the
 * project via `detect()` and delegates every guard-rail to it.
 */
export interface ShieldAdapter {
  /** Unique id, e.g. "typescript", "python" */
  readonly id: string;

  /**
   * Detect if this adapter applies to the project at `cwd`. Pure and
   * deterministic: checks for language markers (package.json, pyproject.toml,
   * go.mod). Called by `detectAdapter`, which returns the first adapter whose
   * `detect()` returns true.
   */
  detect(cwd: string): boolean;

  /** Lint / type-check / test guard commands; null means the step is skipped. */
  getLintCommand(): GuardCommand | null;
  getTypeCheckCommand(): GuardCommand | null;
  getTestCommand(): GuardCommand | null;

  /** Extract public API symbols from `files` (for drift check). */
  extractApi(files: string[]): string[];

  /** Security patterns to scan source for. */
  getSecurityPatterns(): Array<{ re: RegExp; label: string }>;

  /** File metrics (LOC + import count) for the YAGNI check. */
  fileMetrics(file: string): { loc: number; imports: number };
}

/** Known adapters registry */
const _adapters: ShieldAdapter[] = [];

export function registerAdapter(adapter: ShieldAdapter): void {
  if (!_adapters.find((a) => a.id === adapter.id)) {
    _adapters.push(adapter);
  }
}

export function getAdapters(): readonly ShieldAdapter[] {
  return _adapters;
}

/** Detect the best adapter for a project directory */
export function detectAdapter(cwd: string): ShieldAdapter | null {
  for (const a of _adapters) {
    if (a.detect(cwd)) return a;
  }
  return null;
}

/** Clear all registered adapters (for testing) */
export function clearAdapters(): void {
  _adapters.length = 0;
}
