import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OrionTrack } from "../core/track.js";
import { statusMark } from "../utils/term.js";

/**
 * `orion clean` (v0.37) — remove cache entries, temporary artifacts and
 * reports. Never touches changes/ or .orion/lessons.json (user data).
 * Safe: only removes files Orion itself can regenerate.
 */
export function cleanCmd(
  args: string[],
): { ok: boolean; text: string } {
  const what = args[0] ?? "cache";
  const removed: string[] = [];

  if (what === "cache" || what === "all") {
    try {
      const track = OrionTrack.init();
      const stats = track.getStats();
      track.clear();
      removed.push(
        `cache: ${stats.count} entries (${((stats.size ?? 0) / 1024).toFixed(1)} KB) cleared`,
      );
    } catch (err) {
      removed.push(
        `cache: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (what === "reports" || what === "all") {
    const reportsDir = join(process.cwd(), "reports");
    if (existsSync(reportsDir)) {
      try {
        rmSync(reportsDir, { recursive: true, force: true });
        removed.push("reports/ removed");
      } catch (err) {
        removed.push(
          `reports: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      removed.push("reports/ not present");
    }
  }

  if (what === "dist" || what === "all") {
    const distDir = join(process.cwd(), "dist");
    if (existsSync(distDir)) {
      try {
        rmSync(distDir, { recursive: true, force: true });
        removed.push("dist/ removed (rebuild with: pnpm run build)");
      } catch (err) {
        removed.push(
          `dist: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      removed.push("dist/ not present");
    }
  }

  if (what === "coverage" || what === "all") {
    const covDir = join(process.cwd(), "coverage");
    if (existsSync(covDir)) {
      try {
        rmSync(covDir, { recursive: true, force: true });
        removed.push("coverage/ removed");
      } catch (err) {
        removed.push(
          `coverage: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      removed.push("coverage/ not present");
    }
  }

  if (
    !["cache", "reports", "dist", "coverage", "all"].includes(what)
  ) {
    return {
      ok: false,
      text: `${statusMark("error")} unknown target: ${what}\nUsage: orion clean [cache|reports|dist|coverage|all]`,
    };
  }

  return {
    ok: true,
    text: [
      `${statusMark("done")} Cleaned:`,
      ...removed.map((r) => `  ${r}`),
    ].join("\n"),
  };
}
