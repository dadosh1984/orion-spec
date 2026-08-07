import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { parseArgs } from "../src/cli/commands.js";
import {
  startServer,
  dashboardHtml,
  readVersion,
  listChanges,
  escapeHtml,
} from "../src/cli/serve.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;
let server: Server | null = null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-serve-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

async function request(
  path: string,
): Promise<{ status: number; json: unknown; text: string }> {
  const addr = server!.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${addr.port}${path}`);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}

describe("serve: CLI args", () => {
  it("parses --port and --ui", () => {
    const parsed = parseArgs(["serve", "--port", "4780", "--ui"]);
    expect(parsed.cmd).toBe("serve");
    expect(parsed.opts.port).toBe(4780);
    expect(parsed.opts.ui).toBe(true);
  });

  it("rejects a non-integer --port", () => {
    expect(() => parseArgs(["serve", "--port", "abc"])).toThrow(
      "--port requires a positive integer",
    );
  });

  it("keeps unrelated flags in args", () => {
    const parsed = parseArgs(["scale", "x.ts", "--dry"]);
    expect(parsed.cmd).toBe("scale");
    expect(parsed.args).toEqual(["x.ts"]);
    expect(parsed.opts.dry).toBe(true);
    expect(parsed.opts.port).toBe(0);
  });
});

describe("serve: dashboard", () => {
  it("renders a dashboard page at /", async () => {
    const track = OrionTrack.init();
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Orion");
    expect(res.text).toContain(readVersion());
    expect(res.text).toContain("api/status");
  });

  it("serves /api/status with cache stats and change count", async () => {
    const track = OrionTrack.init();
    track.store("forge:demo", "DONE");
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      JSON.stringify({ title: "demo", goal: "Demo change" }),
      "utf8",
    );
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/api/status");
    expect(res.status).toBe(200);
    const body = res.json as {
      version: string;
      cache: { count: number; bytes: number };
      changes: number;
    };
    expect(body.version).toBe(readVersion());
    expect(body.cache.count).toBeGreaterThanOrEqual(1);
    expect(body.cache.bytes).toBeGreaterThan(0);
    expect(body.changes).toBe(1);
  });

  it("serves /api/cache as a sorted key/value list", async () => {
    const track = OrionTrack.init();
    track.store("scale:yagni:abc", "result");
    track.store("forge:demo", "DONE");
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/api/cache");
    expect(res.status).toBe(200);
    const entries = (
      res.json as { entries: Array<{ key: string; value: unknown }> }
    ).entries;
    expect(entries.map((e) => e.key)).toEqual([
      "forge:demo",
      "scale:yagni:abc",
    ]);
    expect(entries.find((e) => e.key === "forge:demo")?.value).toBe("DONE");
  });

  it("serves /api/changes with proposal summaries and result flags", async () => {
    const track = OrionTrack.init();
    mkdirSync(join("changes", "done"), { recursive: true });
    writeFileSync(
      join("changes", "done", "proposal.json"),
      JSON.stringify({ goal: "Finished" }),
      "utf8",
    );
    writeFileSync(join("changes", "done", "result.md"), "# result", "utf8");
    mkdirSync(join("changes", "todo"), { recursive: true });
    writeFileSync(
      join("changes", "todo", "proposal.json"),
      JSON.stringify({ goal: "In progress" }),
      "utf8",
    );
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/api/changes");
    expect(res.status).toBe(200);
    const changes = (
      res.json as { changes: Array<{ title: string; hasResult: boolean }> }
    ).changes;
    expect(changes.length).toBe(2);
    expect(changes.find((c) => c.title === "done")?.hasResult).toBe(true);
    expect(changes.find((c) => c.title === "todo")?.hasResult).toBe(false);
  });

  it("serves /health and 404 for unknown paths", async () => {
    const track = OrionTrack.init();
    server = await startServer(track, { port: 0, ui: true });
    const health = await request("/health");
    expect(health.status).toBe(200);
    expect((health.json as { ok: boolean }).ok).toBe(true);
    const missing = await request("/nope");
    expect(missing.status).toBe(404);
  });

  it("serves JSON at / when ui is disabled", async () => {
    const track = OrionTrack.init();
    server = await startServer(track, { port: 0, ui: false });
    const res = await request("/");
    expect(res.status).toBe(200);
    expect((res.json as { service: string }).service).toBe("orion");
  });
});

describe("serve: live metrics", () => {
  it("serves /api/metrics with economy, budget, debt, lessons", async () => {
    const track = OrionTrack.init();
    track.store("scale:yagni:abc", "result");
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/api/metrics");
    expect(res.status).toBe(200);
    const body = res.json as {
      version: string;
      economy: { savedTokens: number; savedBytes: number; entries: number };
      budget: Array<{ namespace: string; bytes: number; tokens: number; share: number }>;
      debt: unknown[];
      lessons: { count: number; lastTs: string | null };
    };
    expect(body.version).toBe(readVersion());
    expect(typeof body.economy.savedTokens).toBe("number");
    expect(Array.isArray(body.budget)).toBe(true);
    expect(body.budget.length).toBeGreaterThanOrEqual(1);
    expect(body.budget[0]?.namespace).toBe("scale");
    expect(Array.isArray(body.debt)).toBe(true);
    expect(typeof body.lessons.count).toBe("number");
    expect(body.lessons).toHaveProperty("lastTs");
  });

  it("serves task progress (done/total) in /api/changes", async () => {
    const track = OrionTrack.init();
    mkdirSync(join("changes", "prog"), { recursive: true });
    writeFileSync(
      join("changes", "prog", "proposal.json"),
      JSON.stringify({ goal: "With tasks" }),
      "utf8",
    );
    writeFileSync(
      join("changes", "prog", "tasks.md"),
      ["# tasks", "", "- [x] one", "- [ ] two", "- [ ] three"].join("\n"),
      "utf8",
    );
    // a change without tasks.md must carry tasks: null
    mkdirSync(join("changes", "empty"), { recursive: true });
    writeFileSync(
      join("changes", "empty", "proposal.json"),
      JSON.stringify({ goal: "No tasks" }),
      "utf8",
    );
    server = await startServer(track, { port: 0, ui: true });
    const res = await request("/api/changes");
    expect(res.status).toBe(200);
    const changes = (
      res.json as { changes: Array<{ title: string; tasks: { done: number; total: number } | null }> }
    ).changes;
    const prog = changes.find((c) => c.title === "prog");
    expect(prog?.tasks).toEqual({ done: 1, total: 3 });
    const empty = changes.find((c) => c.title === "empty");
    expect(empty?.tasks).toBeNull();
  });

  it("dashboardHtml embeds auto-refresh polling and panels", () => {
    const html = dashboardHtml("7.7.7");
    expect(html).toContain("setInterval(refresh, 5000)");
    expect(html).toContain("Token economy");
    expect(html).toContain("Budget by namespace");
    expect(html).toContain("/api/metrics");
    expect(html).toContain("/api/status");
    // every dynamic value rendered through the client esc()
    expect(html).toContain("const esc =");
  });
});

describe("serve: helpers", () => {
  it("dashboardHtml embeds the version", () => {
    const html = dashboardHtml("9.9.9");
    expect(html).toContain("v9.9.9");
  });

  it("escapeHtml neutralizes XSS payloads", () => {
    const payload = `<img src=x onerror=alert(document.cookie)>`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).toContain("&lt;img");
    expect(escaped).toContain("&gt;");
  });

  it("listChanges returns an empty array when changes/ is absent", () => {
    expect(listChanges()).toEqual([]);
  });
});
