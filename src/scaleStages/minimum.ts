/**
 * YAGNI stage 7 — minimum.
 * Removes `console.*` statements, `debugger` statements, comments and
 * blank lines — anything not strictly required for the code to run.
 */
export function handler(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      let l = stripLineComment(line);
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

/**
 * Remove a `//` comment only when it is not inside a string/template
 * literal — `http://x` in a string must survive.
 */
export function stripLineComment(line: string): string {
  let inString: "'" | '"' | null = null;
  let inTemplate = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (inTemplate) {
      if (ch === "`") inTemplate = false;
      continue;
    }
    if (inString) {
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }
    if (ch === "/" && next === "/") return line.slice(0, i);
  }
  return line;
}
