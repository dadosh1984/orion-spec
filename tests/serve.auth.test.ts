import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { parseArgs } from "../src/cli/commands.js";
import {
  startServer,
  isLoopbackHost,
  generateToken,
  dashboardHtml,
  type ServeOptions,
} from "../src/cli/serve.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;
let server: (Server & { authToken?: string }) | null = null;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-auth-"));
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

async function boot(opts: Partial<ServeOptions> = {}) {
  const track = OrionTrack.init();
  server = await startServer(track, {
    port: 0,
    ui: true,
    host: "127.0.0.1",
    ...opts,
  });
  return server;
}

async function get(
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  const addr = server!.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${addr.port}${path}`, { headers });
  return { status: res.status, text: await res.text() };
}

describe("serve dashboard auth", () => {
  it("keeps the loopback default open with no token", async () => {
    await boot();
    const res = await get("/api/status");
    expect(res.status).toBe(200);
    expect(server!.authToken).toBeUndefined();
  });

  it("requires the token when one is set (even on loopback)", async () => {
    await boot({ token: "sekret" });
    expect(server!.authToken).toBe("sekret");
    expect((await get("/api/status")).status).toBe(401);
    expect(
      (await get("/api/status", { Authorization: "Bearer wrong" })).status,
    ).toBe(401);
    expect(
      (await get("/api/status", { Authorization: "Bearer sekret" })).status,
    ).toBe(200);
    // x-orion-token header also works
    expect(
      (await get("/api/status", { "x-orion-token": "sekret" })).status,
    ).toBe(200);
    // ?token= query works (used by the dashboard UI)
    expect((await get("/api/status?token=sekret")).status).toBe(200);
  });

  it("auto-generates a token when binding a non-loopback host", async () => {
    await boot({ host: "0.0.0.0" });
    expect(server!.authToken).toBeTruthy();
    expect((await get("/api/status")).status).toBe(401);
    const tok = server!.authToken!;
    expect(
      (await get("/api/status", { Authorization: `Bearer ${tok}` })).status,
    ).toBe(200);
  });

  it("parses --token in the CLI", () => {
    const parsed = parseArgs(["serve", "--token", "abc123"]);
    expect(parsed.opts.token).toBe("abc123");
    expect(() => parseArgs(["serve", "--token"])).toThrow();
  });

  it("sends the page token via the X-Orion-Token header, not the query string", () => {
    // v0.23: the UI reads the token from the page URL ONCE and sends it as a
    // header on every /api fetch — a ?token= query string leaks into server
    // access logs, browser history and the Referer header.
    const html = dashboardHtml("0.0.0");
    expect(
      html.includes('new URLSearchParams(location.search).get("token")'),
    ).toBe(true);
    expect(html.includes('"X-Orion-Token": t')).toBe(true);
    expect(html.includes('fetch("/api/status" + q)')).toBe(false);
  });
});

describe("serve auth helpers", () => {
  it("detects loopback hosts", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.5")).toBe(false);
  });

  it("generates a 32-char token, unique per call", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toHaveLength(32);
    expect(a).not.toBe(b);
  });
});
