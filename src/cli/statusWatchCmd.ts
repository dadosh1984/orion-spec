import { scanChanges, listTable } from "./overviewCmd.js";

/**
 * `orion status --watch` (v0.37) — live table of all changes, refreshed
 * every 2 seconds. Zero-dependency: plain setInterval + ansi escape to
 * clear the screen. Ctrl+C to exit.
 */
export function statusWatch(): void {
  let running = true;
  const refresh = (): void => {
    // ANSI: clear screen, move cursor to 0,0
    process.stdout.write("\x1b[2J\x1b[H");
    const rows = scanChanges();
    if (rows.length === 0) {
      process.stdout.write('No changes yet. Run: orion think "..."\n');
      process.stdout.write("\nWatching for changes... (Ctrl+C to exit)\n");
    } else {
      process.stdout.write(`${listTable(rows)}\n`);
      process.stdout.write("\nRefreshing every 2s (Ctrl+C to exit)\n");
    }
  };

  refresh();
  const timer = setInterval(() => {
    if (running) refresh();
  }, 2000);

  process.on("SIGINT", () => {
    running = false;
    clearInterval(timer);
    process.stdout.write("\n");
    process.exit(0);
  });

  // Keep the process alive
  process.stdin.resume();
}
