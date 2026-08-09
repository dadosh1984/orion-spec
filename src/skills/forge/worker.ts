/**
 * Fork worker for `orion forge --parallel` (v0.16).
 *
 * Receives one `{title, slug, noCache}` task over IPC, runs its RED-GREEN
 * cycle through the shared `executeTask` (single source of truth), and
 * replies `{slug, status, reason?, lastFailure?}` before exiting.
 * Deliberately minimal: it never touches shared files (tasks.md,
 * lessons.json, forge cache) — the parent applies all bookkeeping
 * sequentially after each wave, so shared files have exactly one writer.
 * The token-economy cache is per-key files, so `finalize`'s `tdd:<slug>`
 * store inside the cycle cannot race the parent.
 */
import { OrionTrack } from "../../core/track.js";
import { executeTask, defaultEngineFactory } from "./handler.js";
import { resolveSnippet } from "./snippet.js";

interface WorkerTask {
  title: string;
  slug: string;
  noCache?: boolean;
}

interface WorkerReply {
  slug: string;
  status: "done" | "pending";
  reason?: "no-snippet" | "red";
  lastFailure?: string;
}

function reply(msg: WorkerReply): void {
  if (process.send) process.send(msg);
  process.exit(0);
}

process.on("message", async (msg: WorkerTask) => {
  const { title, slug } = msg;
  const snippetProvider = async (s: string): Promise<string | null> => {
    return resolveSnippet(`changes/${title}/snippets`, s).content;
  };
  const track = OrionTrack.init();
  let outcome;
  try {
    outcome = await executeTask(
      title,
      slug,
      slug,
      snippetProvider,
      defaultEngineFactory,
      track,
    );
  } catch (err) {
    return reply({
      slug,
      status: "pending",
      reason: "red",
      lastFailure: `worker failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  return reply({
    slug,
    status: outcome.ok ? "done" : "pending",
    // The worker has no timeout path — a timeout is decided only by the
    // parent's forkRunner. Narrow the union back to the worker's domain.
    reason: outcome.reason === "timeout" ? "red" : outcome.reason,
    lastFailure: outcome.lastFailure,
  });
});
