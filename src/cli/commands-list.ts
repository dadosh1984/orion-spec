/**
 * Master command list (v0.38) — single source of truth.
 */
export const ORION_COMMANDS: ReadonlyArray<string> = Object.freeze([
  "think", "plan", "draft", "forge", "tasks", "shield", "verify",
  "out", "pay-debt", "resume", "next", "init", "changelog", "list",
  "status", "compare", "assumptions", "stats", "self-audit",
  "backup", "restore", "review", "archive", "doctor", "learn",
  "track", "scale", "tdd", "metrics", "mcp", "serve", "plugin",
  "config", "clean", "profile", "help", "version", "shell",
  "env", "history", "diff", "completion",
  "run",
]);

export const ORION_FLAGS: ReadonlyArray<string> = Object.freeze([
  "--no-cache", "--no-color", "--dry", "--watch", "--json",
  "--npm", "--port", "--host", "--session", "--parallel",
  "--token", "--ui", "--lang", "--version", "-V", "--help", "-h",
]);
