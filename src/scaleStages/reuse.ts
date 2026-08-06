import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";

/** A top-level function declaration found in source code. */
interface FunctionDecl {
  name: string;
  start: number;
  end: number; // index just past the closing brace
  body: string;
}

/**
 * YAGNI stage 2 — reuse.
 * Finds duplicate top-level function declarations in the project's `.ts`
 * files and replaces later occurrences with an import of the first one.
 * Best-effort, deterministic transform using brace-matching scans.
 */
export function handler(code: string): string {
  const funcs = collectFunctions(code);
  if (funcs.size === 0) return code;

  const projectFiles = collectTsFiles(process.cwd(), 2);
  const library = new Map<string, { file: string; name: string }>();

  for (const file of projectFiles) {
    try {
      const source = readFileSync(file, "utf8");
      for (const [, decl] of collectFunctions(source)) {
        const local = funcs.get(decl.name);
        if (local && decl.body === local.body && !library.has(decl.name)) {
          library.set(decl.name, { file, name: decl.name });
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  let result = code;
  for (const name of library.keys()) {
    const decl = funcs.get(name);
    if (!decl) continue;
    const importLine = `import { ${name} } from './${stripExtension(basename(library.get(name)!.file))}';`;
    result = result.slice(0, decl.start) + importLine + result.slice(decl.end);
  }
  return result;
}

/** Find all top-level `export function name(...) ... { ... }` declarations. */
function collectFunctions(code: string): Map<string, FunctionDecl> {
  const map = new Map<string, FunctionDecl>();
  // `{` is optional in the match: a typed function like
  // `export function add(a: number, b: number): number {` has a return-type
  // annotation between `)` and `{`. indexOf() below locates the body brace;
  // the annotation itself may not contain `{` (object types are skipped).
  const re = /export\s+function\s+(\w+)\s*\([^)]*\)\s*(?::[^{]*)?\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const open = code.indexOf("{", m.index + m[0].length - 1);
    if (open === -1) continue;
    const close = matchBrace(code, open);
    if (close === -1) continue;
    map.set(m[1], {
      name: m[1],
      start: m.index,
      end: close + 1,
      body: code.slice(open + 1, close).trim(),
    });
  }
  return map;
}

/** Return the index of the brace matching the one at `openIndex`. */
function matchBrace(code: string, openIndex: number): number {
  let depth = 0;
  let inString: "'" | '"' | null = null;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === "`") inTemplate = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
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
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Recursively collect `.ts` files up to a given depth. */
function collectTsFiles(dir: string, depth: number): string[] {
  if (depth < 0) return [];
  const out: string[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e === "dist" || e === ".git") continue;
    const full = join(dir, e);
    try {
      const st = statSync(full);
      if (st.isDirectory()) out.push(...collectTsFiles(full, depth - 1));
      else if (e.endsWith(".ts")) out.push(full);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function stripExtension(file: string): string {
  return file.replace(/\.ts$/, "");
}
