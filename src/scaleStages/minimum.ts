/**
 * YAGNI stage 7 — minimum.
 * Removes `console.*` statements, `debugger` statements, comments and
 * blank lines — anything not strictly required for the code to run.
 */
export function handler(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      let l = line;
      // strip // comments (not inside strings — best effort)
      l = l.replace(/\/\/.*$/, "");
      // whole-line console statements (balanced parens via .*)
      if (/^\s*console\.[a-zA-Z]+\(.*\);?\s*$/.test(l)) return "";
      // inline console.* and debugger statements
      l = l.replace(/\bconsole\.[a-zA-Z]+\([^)]*\);?\s*/g, "");
      l = l.replace(/\bdebugger\s*;?\s*/g, "");
      return l;
    })
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}
