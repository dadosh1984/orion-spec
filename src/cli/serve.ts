import http from "node:http";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OrionTrack } from "../core/track.js";

/** Options for the `orion serve` web dashboard. */
export interface ServeOptions {
  /** Port to listen on (0 = ephemeral, useful for tests). */
  port: number;
  /** Serve the HTML dashboard at `/` (defaults to true). */
  ui: boolean;
}

interface ApiChange {
  title: string;
  goal: string | null;
  hasResult: boolean;
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
      return {
        title: name,
        goal,
        hasResult: existsSync(join("changes", name, "result.md")),
      };
    });
}

/** Readable size helper for the dashboard. */
function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
  main { padding: 24px; display: grid; grid-template-columns: 320px 1fr;
         gap: 24px; }
  @media (max-width: 800px) { main { grid-template-columns: 1fr; } }
  section { background: #161a23; border: 1px solid #262a36; border-radius: 8px;
            padding: 16px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: #8b93a7; margin: 0 0 12px; }
  .stat { display: flex; justify-content: space-between; padding: 6px 0;
          border-bottom: 1px dashed #232838; }
  .stat:last-child { border-bottom: none; }
  .stat b { color: #e2e6ef; }
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
</style>
</head>
<body>
<header>
  <h1>🪐 Orion</h1>
  <span>v${version} · token-economy cache · dashboard</span>
</header>
<main>
  <section>
    <h2>Cache</h2>
    <div id="cache"><p class="err">loading…</p></div>
    <p style="margin:12px 0 0"><button onclick="refresh()">Refresh</button></p>
  </section>
  <section>
    <h2>Changes</h2>
    <ul id="changes"><li class="err">loading…</li></ul>
  </section>
</main>
<script>
async function refresh() {
  try {
    const status = await fetch("/api/status").then(r => r.json());
    const cache = document.getElementById("cache");
    cache.innerHTML =
      '<div class="stat"><span>entries</span><b>' + status.cache.count + '</b></div>' +
      '<div class="stat"><span>size</span><b>' + status.cache.size + '</b></div>' +
      '<div class="stat"><span>last write</span><b>' + (status.cache.lastPrune ?? "never") + '</b></div>';
    const changes = await fetch("/api/changes").then(r => r.json());
    const list = document.getElementById("changes");
    list.innerHTML = changes.length
      ? changes.map(c =>
          '<li><b>' + c.title + '</b>' +
          (c.hasResult ? '<span class="tag done">result</span>' : '') +
          (c.goal ? '<div style="color:#8b93a7;font-size:12px;margin-top:4px">' + c.goal + '</div>' : '')
        ).join("")
      : '<li>no changes yet — run <code>orion think</code></li>';
  } catch (err) {
    document.getElementById("cache").innerHTML =
      '<p class="err">' + err + '</p>';
  }
}
refresh();
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
    server.listen(opts.port, () => {
      server.removeListener("error", reject);
      resolve(server);
    });
  });
}
