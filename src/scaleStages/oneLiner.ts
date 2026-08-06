/**
 * YAGNI stage 6 — oneLiner.
 * Collapses simple arrow functions of the form `x => { return y; }` into
 * the expression form `x => y`, and simplifies trivially-assignable
 * ternaries. Only touches lines longer than 80 characters.
 */
export function handler(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      if (line.length <= 80) return line;
      return line
        .replace(
          /((?:\(\s*[\w$]+\s*\)|\w+)\s*=>\s*)\{\s*return\s+([^;{}]+);\s*\}/,
          "$1$2",
        )
        .replace(/(\w+)\s*=\s*(.+?)\s*\?\s*true\s*:\s*false/, "$1 = !!($2)");
    })
    .join("\n");
}
