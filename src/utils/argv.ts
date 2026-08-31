/**
 * Argv tokenization (v0.68).
 *
 * `$EDITOR`/`$VISUAL` may carry both a path and flags: `code -w`,
 * `"C:\Program Files\Notepad++\notepad++.exe" -multiInst`. Splitting on
 * `\S+` (the old B1 approach) breaks any quoted path that contains spaces —
 * the first token becomes `"C:\Program` and spawn fails. This tokenizer is a
 * small, shell-free splitter that honours single and double quotes so a
 * quoted path survives as one argv element, without ever handing the string
 * to a shell (no injection surface).
 *
 * It is intentionally minimal: quote grouping and whitespace separation only.
 * No variable expansion, no glob, no backtick/subshell — those belong to a
 * shell, which we deliberately do not use.
 */
export function tokenizeArgv(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let started = false; // distinguishes an empty quoted token ("") from no token

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inSingle) {
      if (ch === "'") inSingle = false;
      else current += ch;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      else current += ch;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      started = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      started = true;
      continue;
    }
    if (ch === " " || ch === "\t") {
      if (started) {
        tokens.push(current);
        current = "";
        started = false;
      }
      continue;
    }
    current += ch;
    started = true;
  }

  if (started) tokens.push(current);
  return tokens;
}
