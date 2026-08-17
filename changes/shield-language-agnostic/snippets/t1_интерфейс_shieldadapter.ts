// === T1: Интерфейс ShieldAdapter + типы ===
// ponytail: rung-1 — interface needed for adapter pattern
// ponytail: rung-3 — extractApi/fileMetrics needed for drift/yagni
// ponytail: rung-4 — no runtime deps, pure TS types

/**
 * Language-agnostic guard interface.
 * Each language (TypeScript, Python, Go, ...) implements this interface.
 */
export interface GuardCommand {
  cmd: string;
  args: string[];
  /** Optional stdout parser; default: exit code based */
  parser?: (stdout: string) => { status: "PASS" | "FAIL"; detail: string };
}

export interface ShieldAdapter {
  /** Unique id, e.g. "typescript", "python" */
  readonly id: string;

  /** Detect if this adapter applies to the project at cwd */
  detect(cwd: string): boolean;

  /** Guard commands; null means the step is skipped */
  getLintCommand(): GuardCommand | null;
  getTypeCheckCommand(): GuardCommand | null;
  getTestCommand(): GuardCommand | null;

  /** Extract public API symbols from source files (for drift check) */
  extractApi(files: string[]): string[];

  /** Security patterns to scan source for */
  getSecurityPatterns(): Array<{ re: RegExp; label: string }>;

  /** File metrics for YAGNI check */
  fileMetrics(file: string): { loc: number; imports: number };
}

/** Known adapters registry */
const _adapters: ShieldAdapter[] = [];

export function registerAdapter(adapter: ShieldAdapter): void {
  _adapters.push(adapter);
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

export function clearAdapters(): void {
  _adapters.length = 0;
}
