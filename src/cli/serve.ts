import http from "node:http";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OrionTrack } from "../core/track.js";
import { economyStats } from "../core/compress.js";
import { tokenBudget } from "../core/metrics.js";
import { readDebt } from "../core/debt.js";
import { lessonsStats } from "../core/lessons.js";
import { readTasks } from "../skills/forge/handler.js";

/** Options for the `orion serve` web dashboard. */
export interface ServeOptions {
  /** Port to listen on (0 = ephemeral, useful for tests). */
  port: number;
  /** Serve the HTML dashboard at `/` (defaults to true). */
  ui: boolean;
  /** Host to bind (default 127.0.0.1 — loopback only). */
  host?: string;
}

interface ApiChange {
  title: string;
  goal: string | null;
  hasResult: boolean;
  /** Task checklist progress read from tasks.md, when one exists. */
  tasks: { done: number; total: number } | null;
}

const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));

/** Read the package version for the dashboard footer / API. */
export function readVersion(): string {
  try {
    const raw = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version?: string;
    };
    return raw.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/** List the change directories in ./changes with their proposal summaries. */
export function listChanges(): ApiChange[] {
  if (!existsSync("changes")) return [];
  return readdirSync("changes")
    .filter((name) => existsSync(join("changes", name, "proposal.json")))
    .map((name) => {
      let goal: string | null = null;
      try {
        const raw = JSON.parse(
          readFileSync(join("changes", name, "proposal.json"), "utf8"),
        ) as { goal?: string };
        goal = raw.goal ?? null;
      } catch {
        /* no proposal summary */
      }
      const tasks = readTasks(name);
      return {
        title: name,
        goal,
        hasResult: existsSync(join("changes", name, "result.md")),
        tasks:
          tasks.length > 0
            ? {
                done: tasks.filter((t) => t.done).length,
                total: tasks.length,
              }
            : null,
      };
    });
}

/** Readable size helper for the dashboard. */
function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Escape HTML metacharacters — prevents stored XSS via change titles/goals. */
export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

/** Render the single-file dashboard (zero dependencies, vanilla JS). */
export function dashboardHtml(version: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Orion dashboard</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
         margin: 0; background: #0f1117; color: #d7dae2; }
  header { padding: 18px 24px; border-bottom: 1px solid #262a36;
           display: flex; align-items: baseline; gap: 14px; }
  header h1 { font-size: 18px; margin: 0; color: #fff; }
  header span { color: #6b7280; font-size: 12px; }
  main { padding: 24px; display: grid;
         grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
  section { background: #161a23; border: 1px solid #262a36; border-radius: 8px;
            padding: 16px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: #8b93a7; margin: 0 0 12px; }
  .stat { display: flex; justify-content: space-between; padding: 6px 0;
          border-bottom: 1px dashed #232838; }
  .stat:last-child { border-bottom: none; }
  .stat b { color: #e2e6ef; }
  .bar-row { display: flex; align-items: center; gap: 8px; padding: 4px 0;
             font-size: 12px; }
  .bar-row .lbl { width: 96px; overflow: hidden; text-overflow: ellipsis;
                  white-space: nowrap; color: #93a1c1; }
  .bar-row .fill { color: #7ee2a8; letter-spacing: 0; }
  .bar-row .val { color: #8b93a7; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 8px 0; border-bottom: 1px dashed #232838; }
  li:last-child { border-bottom: none; }
  .tag { font-size: 11px; border-radius: 4px; padding: 2px 6px;
         background: #1d2332; color: #93a1c1; margin-left: 8px; }
  .done { background: #12301f; color: #7ee2a8; }
  button { background: #1e2534; color: #d7dae2; border: 1px solid #2e3548;
           border-radius: 6px; padding: 6px 14px; cursor: pointer; }
  button:hover { background: #262e40; }
  .err { color: #ff7b72; }
  .foot { color: #5b6270; font-size: 11px; margin-top: 12px; }
</style>
</head>
<body>
<header>
  <h1>🪐 Orion</h1>
  <span>v${version} · token-economy cache · live dashboard</span>
</header>
<main>
  <section>
    <h2>Cache</h2>
    <div id="cache"><p class="err">loading…</p></div>
  </section>
  <section>
    <h2>Token economy</h2>
    <div id="economy"><p class="err">loading…</p></div>
  </section>
  <section>
    <h2>Budget by namespace</h2>
    <div id="budget"><p class="err">loading…</p></div>
  </section>
  <section>
    <h2>Debt · Lessons</h2>
    <div id="pulse"><p class="err">loading…</p></div>
  </section>
  <section style="grid-column:1/-1">
    <h2>Changes</h2>
    <p style="margin:0 0 8px"><button onclick="refresh()">Refresh now</button>
       <span class="foot">auto-refresh every 5s</span></p>
    <ul id="changes"><li class="err">loading…</li></ul>
  </section>
</main>
<script>
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(items) { return items.map(i => i).join(""); }
function stat(label, value) {
  return '<div class="stat"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
}
async function refresh() {
  try {
    const [status, metrics, changes] = await Promise.all([
      fetch("/api/status").then(r => r.json()),
      fetch("/api/metrics").then(r => r.json()),
      fetch("/api/changes").then(r => r.json()),
    ]);
    const cache = document.getElementById("cache");
    cache.innerHTML =
      stat("entries", status.cache.count) +
      stat("size", status.cache.size) +
      stat("last write", status.cache.lastPrune ?? "never") +
      stat("changes", status.changes);

    const economy = document.getElementById("economy");
    const eco = metrics.economy || {};
    let proj = (eco.byProject || []).slice(0, 5)
      .map(p => stat(esc(p.project), "≈" + p.savedTokens + " tok"))
      .join("");
    economy.innerHTML =
      stat("saved", "≈" + (eco.savedTokens ?? 0) + " tok (" + human(eco.savedBytes ?? 0) + ")") +
      stat("ops", eco.entries ?? 0) +
      (proj ? '<div style="margin-top:8px"></div>' + proj : "");

    const budget = document.getElementById("budget");
    const list = metrics.budget || [];
    const max = Math.max(...list.map(b => b.bytes), 0);
    budget.innerHTML = list.length
      ? list
          .slice(0, 8)
          .map(b => {
            const pct = Math.round((b.share ?? 0) * 100);
            return '<div class="bar-row"><span class="lbl">' + esc(b.namespace) +
              '</span><span class="fill">' + bar(b.bytes, max) +
              '</span><span class="val">' + human(b.bytes) + ' · ≈' + b.tokens +
              ' tok · ' + pct + '%</span></div>';
          })
          .join("")
      : "<p class='err'>cache empty</p>";

    const pulse = document.getElementById("pulse");
    const debt = (metrics.debt || []).length;
    const lessons = metrics.lessons || {};
    pulse.innerHTML =
      stat("open debt", debt) +
      stat("lessons", lessons.count ?? 0) +
      stat("last lesson", lessons.lastTs ?? "never") +
      '<p style="margin:12px 0 0"><button onclick="refresh()">Refresh now</button>' +
      '<span class="foot"> auto-refresh every 5s</span></p>';

    const listEl = document.getElementById("changes");
    const ch = changes.changes || [];
    listEl.innerHTML = ch.length
      ? ch.map(c => {
          let tags = '';
          if (c.hasResult) tags += '<span class="tag done">result</span>';
          if (c.tasks) tags += '<span class="tag">' + c.tasks.done + '/' + c.tasks.total +
            ' tasks</span>';
          return '<li><b>' + esc(c.title) + '</b>' + tags +
            (c.goal
              ? '<div style="color:#8b93a7;font-size:12px;margin-top:4px">' + esc(c.goal) + '</div>'
              : '') +
            '</li>';
        }).join("")
      : '<li>no changes yet — run <code>orion think</code></li>';
  } catch (err) {
    document.getElementById("changes").innerHTML =
      '<p class="err">' + esc(String(err)) + '</p>';
  }
}
function human(n) {
  if (n >= 1048576) return (n/1048576).toFixed(1) + " MB";
  if (n >= 1024) return (n/1024).toFixed(1) + " KB";
  return n + " B";
}
function bar(v, m) {
  const w = 14;
  if (m <= 0) return "";
  const filled = Math.round((v / m) * w);
  return "█".repeat(filled) + "░".repeat(Math.max(0, w - filled));
}
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
}

/**
 * Start the web dashboard server. Resolves once the port is listening;
 * the caller is responsible for closing it (or waiting for SIGINT).
 */
export function startServer(
  track: OrionTrack,
  opts: ServeOptions,
): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    switch (url.pathname) {
      case "/": {
        if (opts.ui) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(dashboardHtml(readVersion()));
        } else {
          sendJson(res, 200, {
            ok: true,
            service: "orion",
            version: readVersion(),
          });
        }
        return;
      }
      case "/api/status": {
        const stats = track.getStats();
        sendJson(res, 200, {
          version: readVersion(),
          cache: {
            count: stats.count,
            size: humanBytes(stats.size),
            bytes: stats.size,
            lastPrune: stats.lastPrune,
          },
          changes: listChanges().length,
        });
        return;
      }
      case "/api/metrics": {
        // Aggregated live metrics: token economy, cache budget by
        // namespace, open debt, and self-correction lessons. All derived
        // from existing Orion ledgers — no state mutation here.
        sendJson(res, 200, {
          version: readVersion(),
          economy: economyStats(),
          budget: tokenBudget(track),
          debt: readDebt(),
          lessons: lessonsStats(),
        });
        return;
      }
      case "/api/cache": {
        const entries = track
          .keys()
          .map((key) => {
            let size = 0;
            try {
              size = statSync(track.entryPath(key)).size;
            } catch {
              /* ignore */
            }
            return { key, value: track.load(key), size };
          })
          .sort((a, b) => a.key.localeCompare(b.key));
        sendJson(res, 200, { entries });
        return;
      }
      case "/api/changes": {
        sendJson(res, 200, { changes: listChanges() });
        return;
      }
      case "/health": {
        sendJson(res, 200, { ok: true });
        return;
      }
      default:
        sendJson(res, 404, { error: "not found" });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Loopback-only by default: the dashboard exposes cache contents with no
    // auth, so it must not be reachable from the network unless opted in.
    server.listen(opts.port, opts.host ?? "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}
