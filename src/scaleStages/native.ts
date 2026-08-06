/**
 * YAGNI stage 4 — native.
 * Replaces synchronous `fs.readFileSync(...)` calls with the async
 * `await fs.promises.readFile(...)` form. Best-effort transform: only
 * replaces calls that are not already awaited.
 */
export function handler(code: string): string {
  return code.replace(
    /(?!await\s)fs\.readFileSync\(\s*([^)]+)\s*\)/g,
    (_full, args: string) => `await fs.promises.readFile(${args})`,
  );
}
