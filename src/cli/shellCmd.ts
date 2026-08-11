import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { main } from "./commands.js";
import { ORION_COMMANDS } from "./commands-list.js";
import { appendHistory } from "./historyCmd.js";
import { readVersionSafe } from "../utils/version.js";

/**
 * `orion shell` (v0.37) — interactive REPL with command history and
 * tab-completion. Zero-dependency: node:readline with a minimal
 * completer. Type `help` or `exit`/`quit`/Ctrl+D.
 */
export async function shell(): Promise<void> {
  const commands = [...ORION_COMMANDS, "exit", "quit"];

  const completer = (line: string): [string[], string] => {
    const words = line.split(/\s+/);
    const partial = words[words.length - 1] ?? "";
    const hits = commands.filter((c) => c.startsWith(partial));
    return [hits.length > 0 ? hits : commands, partial];
  };

  const rl = createInterface({
    input: stdin,
    output: stdout,
    completer,
    prompt: "orion> ",
    terminal: true,
  });

  console.log([
    `🪐 Orion shell v${readVersionSafe()}`,
    "Type a command (think, draft, forge, shield, out, …) or help.",
    "Tab-complete is on.  exit / quit / Ctrl+D to leave.",
    "",
  ].join("\n"));

  rl.prompt();

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    appendHistory(trimmed);
    if (!trimmed) {
      rl.prompt();
      return;
    }
    if (trimmed === "exit" || trimmed === "quit") {
      console.log("bye");
      rl.close();
      return;
    }
    if (trimmed === "help") {
      console.log(
        "Commands: " + commands.filter((c) => c !== "exit" && c !== "quit").join(", "),
      );
      console.log("Flags: --no-cache --dry --json --watch …");
      console.log("");
      rl.prompt();
      return;
    }
    // Shell built-ins (exit/quit/help don't go through main)
    const args = trimmed.split(/\s+/);
    try {
      await main(args);
    } catch (err) {
      console.error(
        `orion: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("");
    process.exit(0);
  });
}
