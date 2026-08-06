/** Node.js built-in modules that should always use the `node:` prefix. */
const NODE_BUILTINS = new Set([
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
]);

/**
 * YAGNI stage 3 — stdlib.
 * Prefixes bare imports of Node built-ins with `node:` so the module
 * resolution is explicit and unambiguous.
 */
export function handler(code: string): string {
  return code
    .replace(/from\s+['"](\w[\w-]*)['"]/g, (full, mod: string) =>
      NODE_BUILTINS.has(mod) ? `from 'node:${mod}'` : full,
    )
    .replace(/require\(\s*['"](\w[\w-]*)['"]\s*\)/g, (full, mod: string) =>
      NODE_BUILTINS.has(mod) ? `require('node:${mod}')` : full,
    );
}
