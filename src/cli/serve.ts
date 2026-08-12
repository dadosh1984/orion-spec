import http from "node:http";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OrionTrack } from "../core/track.js";
import { humanBytes } from "../utils/file.js";
import { isLoopbackHost } from "../utils/net.js";
export { isLoopbackHost } from "../utils/net.js";
import { generateToken } from "../utils/crypto.js";
export { generateToken } from "../utils/crypto.js";
import { redactValue } from "../utils/redact.js";
import { economyStats } from "../core/compress.js";
import { tokenBudget } from "../core/metrics.js";
import { readDebt } from "../core/debt.js";
import { lessonsStats } from "../core/lessons.js";
import { readTasks } from "../skills/forge/handler.js";
import { phaseOf } from "../core/changeStatus.js";
import { readProfile } from "../core/profile.js";
import { driftOf } from "../core/drift.js";

/** Options for the `orion serve` web dashboard. */
export interface ServeOptions {
  /** Port to listen on (0 = ephemeral, useful for tests). */
  port: number;
  /** Serve the HTML dashboard at `/` (defaults to true). */
  ui: boolean;
  /** Host to bind (default 127.0.0.1 — loopback only). */
  host?: string;
  /**
   * Optional bearer token. When omitted on a non-loopback host one is
   * auto-generated, so an exposed dashboard is never unauthenticated.
   */
  token?: string;
}

/** Constant-time string comparison (avoids timing side-channels). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pull a bearer token out of a request (header or ?token= query). */
function extractToken(req: http.IncomingMessage, url: URL): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  const header = req.headers["x-orion-token"];
  if (typeof header === "string" && header.length > 0) return header;
  const query = url.searchParams.get("token");
  return query && query.length > 0 ? query : null;
}

interface ApiChange {
  title: string;
  goal: string | null;
  hasResult: boolean;
  /** Deterministic workflow stage (think→draft→forge→shield→out), v0.28. */
  phase: string;
  /** guard PASS/FAIL from reports/<id>/guard-report.json, or null. */
  guard: string | null;
  /** drift check ok (spec heading ↔ exported symbol), or null when unknown. */
  drift: boolean | null;
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
      let guard: string | null = null;
      try {
        const gr = JSON.parse(
          readFileSync(join("reports", name, "guard-report.json"), "utf8"),
        ) as { pass: boolean };
        guard = gr.pass ? "pass" : "fail";
      } catch {
        /* no guard report yet */
      }
      // Drift check (v0.30): computed by a focused read of spec + exported
      // symbols, NOT the full reviewChange pass, and memoized by directory
      // mtime so the 5s dashboard auto-refresh does not re-scan every change.
      let drift: boolean | null = null;
      try {
        drift = driftOf(name);
      } catch {
        drift = null;
      }
      return {
        title: name,
        goal,
        phase: phaseOf(name),
        guard,
        drift,
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
  :root, [data-theme="dark"] {
    --bg: #0f1117; --fg: #d7dae2; --card: #161a23;
    --border: #262a36; --dim: #5b6270; --label: #8b93a7;
    --accent: #7ee2a8; --accent-bg: #12301f;
    --err: #ff7b72; --h1: #fff;
  }
  [data-theme="light"] {
    --bg: #ffffff; --fg: #1a1a2e; --card: #f4f4f9;
    --border: #d4d4d8; --dim: #8e8e93; --label: #555;
    --accent: #2e7d32; --accent-bg: #e8f5e9;
    --err: #c62828; --h1: #111;
  }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
         margin: 0; background: var(--bg); color: var(--fg); transition: background 0.3s, color 0.3s; }
  header { padding: 18px 24px; border-bottom: 1px solid var(--border);
           display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  header h1 { font-size: 18px; margin: 0; color: var(--h1); }
  header span { color: var(--dim); font-size: 12px; }
  header .theme-btn { margin-left: auto; background: var(--card); color: var(--fg);
    border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px;
    cursor: pointer; font-size: 12px; }
  main { padding: 24px; display: grid;
         grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
  section { background: var(--card); border: 1px solid var(--border); border-radius: 8px;
            padding: 16px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em;
       color: var(--label); margin: 0 0 12px; }
  .stat { display: flex; justify-content: space-between; padding: 6px 0;
          border-bottom: 1px dashed var(--border); }
  .stat:last-child { border-bottom: none; }
  .stat b { color: var(--fg); }
  .bar-row { display: flex; align-items: center; gap: 8px; padding: 4px 0;
             font-size: 12px; }
  .bar-row .lbl { width: 96px; overflow: hidden; text-overflow: ellipsis;
                  white-space: nowrap; color: var(--label); }
  .bar-row .fill { color: var(--accent); letter-spacing: 0; }
  .bar-row .val { color: var(--label); }
  ul { list-style: none; padding: 0; margin: 0; }
  li { padding: 8px 0; border-bottom: 1px dashed var(--border); }
  li:last-child { border-bottom: none; }
  .tag { font-size: 11px; border-radius: 4px; padding: 2px 6px;
         background: var(--card); color: var(--label); margin-left: 8px; }
  .done { background: var(--accent-bg); color: var(--accent); }
  button { background: var(--card); color: var(--fg); border: 1px solid var(--border);
           border-radius: 6px; padding: 6px 14px; cursor: pointer; filter: brightness(1.2); }
  button:hover { filter: brightness(1.5); }
  .err { color: var(--err); }
  .foot { color: var(--dim); font-size: 11px; margin-top: 12px; }
</style>
</head>
<body>
<header>
  <h1>🪐 Orion</h1>
  <span>v${version} · token-economy cache · live dashboard</span>
  <button class="theme-btn" onclick="toggleTheme()" title="Toggle light/dark theme">☀/🌙</button>
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
// Theme toggle (v0.37): persist in localStorage, default to dark.
(function() {
  const t = localStorage.getItem('orion-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);
})();
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('orion-theme', next);
}
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rows(items) { return items.map(i => i).join(""); }
function stat(label, value) {
  return '<div class="stat"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
}
async function refresh() {
  // Auth travels in the X-Orion-Token header, not in ?token= (v0.23): a
  // query string leaks into server access logs, browser history and the
  // Referer header when the dashboard links out. The page URL may still
  // carry ?token= for the initial load — read it once, send it as a header.
  const t = new URLSearchParams(location.search).get("token");
  const headers = t ? { "X-Orion-Token": t } : {};
  try {
    const [status, metrics, changes] = await Promise.all([
      fetch("/api/status", { headers }).then(r => r.json()),
      fetch("/api/metrics", { headers }).then(r => r.json()),
      fetch("/api/changes", { headers }).then(r => r.json()),
    ]);
    const cache = document.getElementById("cache");
    cache.innerHTML =
      stat("entries", status.cache.count) +
      stat("size", status.cache.size) +
      stat("last write", status.cache.lastPrune ?? "never") +
      stat("changes", status.changes);

    // Profile block (v0.28): the memory.md analogue — what Orion knows
    // about the user. Only what is actually observed is shown.
    const prof = status.profile;
    if (prof) {
      cache.innerHTML += '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #232838"></div>' +
        stat("language", prof.language) +
        stat("platform", prof.platform) +
        stat("budget", prof.budget) +
        stat("topics", (prof.topics || []).join(", ") || "—");
    }

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
          if (c.phase) tags += '<span class="tag">' + esc(c.phase) + '</span>';
          if (c.guard === 'pass') tags += '<span class="tag done">guard ✓</span>';
          else if (c.guard === 'fail') tags += '<span class="tag">guard ✗</span>';
          if (c.drift === true) tags += '<span class="tag done">drift ✓</span>';
          else if (c.drift === false) tags += '<span class="tag">drift ✗</span>';
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
// SSE live refresh (v0.37): push updates instead of 5s poll.
// Falls back to setInterval if EventSource is not available.
if (typeof EventSource !== 'undefined') {
  const es = new EventSource('/api/events' + (t ? '?token=' + t : ''));
  es.onmessage = function() { refresh(); };
  es.onerror = function() {
    // SSE failed — fall back to polling silently.
    es.close();
    setInterval(refresh, 5000);
  };
} else {
  setInterval(refresh, 5000);
}
</script>
</body>
</html>`;
}

/**
 * Start the web dashboard server. Resolves once the port is listening;
 * the caller is responsible for closing it (or waiting for SIGINT).
 * When the effective auth token is set, every request is gated on it.
 */
export function startServer(
  track: OrionTrack,
  opts: ServeOptions,
): Promise<http.Server & { authToken?: string }> {
  const loopback = isLoopbackHost(opts.host ?? "127.0.0.1");
  // Explicit token wins; otherwise a non-loopback bind must not be open.
  const authToken = opts.token ?? (loopback ? undefined : generateToken());

  const server = http.createServer((req, res) => {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    if (authToken !== undefined) {
      const provided = extractToken(req, url);
      if (provided === null || !safeEqual(provided, authToken)) {
        res.writeHead(401, {
          "Content-Type": "application/json; charset=utf-8",
          "WWW-Authenticate": 'Bearer realm="orion"',
        });
        res.end(JSON.stringify({ error: "unauthorized" }, null, 2));
        return;
      }
    }
    switch (url.pathname) {
      case "/api/events": {
        // SSE live-refresh (v0.37): push on every change, fallback to 2s heartbeat.
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("data: {}\n\n");
        const sseTimer = setInterval(() => {
          try {
            res.write("data: {}\n\n");
          } catch {
            clearInterval(sseTimer);
          }
        }, 2000);
        req.on("close", () => clearInterval(sseTimer));
        return;
      }
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
        let profile = null;
        try {
          const p = readProfile();
          profile = {
            language: p.language,
            platform: p.platform || "(none)",
            budget: p.budget || "(none)",
            topics: p.topics.slice(0, 6),
          };
        } catch {
          profile = null;
        }
        sendJson(res, 200, {
          version: readVersion(),
          cache: {
            count: stats.count,
            size: humanBytes(stats.size),
            bytes: stats.size,
            lastPrune: stats.lastPrune,
          },
          changes: listChanges().length,
          profile,
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
            // Redaction (v0.23): raw cache values can hold command output
            // that contains a credential — the dashboard must never echo it
            // back verbatim to anyone holding the token.
            return { key, value: redactValue(track.load(key)), size };
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
      (server as http.Server & { authToken?: string }).authToken = authToken;
      resolve(server);
    });
  });
}
