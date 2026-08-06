import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  McpServer,
  getMcpTools,
  toolManifest,
  SUPPORTED_PROTOCOL_VERSIONS,
} from "../src/core/mcp.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-mcp-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

/** Send a JSON-RPC message and parse the response. */
async function call(
  server: McpServer,
  method: string,
  id = 1,
  params?: unknown,
): Promise<Record<string, unknown>> {
  const raw = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  });
  const res = await server.handleMessage(raw);
  expect(res).not.toBeNull();
  return res as Record<string, unknown>;
}

/** Text payload of a tools/call result. */
function textOf(res: Record<string, unknown>): string {
  const result = res.result as {
    content: Array<{ type: string; text: string }>;
  };
  return result.content.map((c) => c.text).join("");
}

describe("mcp: protocol surface", () => {
  it("exports a standards-compliant tool manifest", () => {
    const manifest = toolManifest() as {
      protocol: string;
      versions: string[];
      transport: string;
      tools: Array<{ name: string; inputSchema: unknown }>;
    };
    expect(manifest.protocol).toBe("model-context-protocol");
    expect(manifest.versions).toEqual(SUPPORTED_PROTOCOL_VERSIONS);
    expect(manifest.transport).toBe("stdio");
    expect(manifest.tools.length).toBeGreaterThanOrEqual(13);
    for (const t of manifest.tools) {
      expect(t.name).toBeTruthy();
      expect((t.inputSchema as { type: string }).type).toBe("object");
    }
  });

  it("initialize negotiates the protocol version and server info", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await call(server, "initialize", 1, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(res.id).toBe(1);
    const info = res.result as {
      protocolVersion: string;
      serverInfo: { name: string; version: string };
      capabilities: { tools: { listChanged: boolean } };
    };
    expect(info.protocolVersion).toBe("2024-11-05");
    expect(info.serverInfo.name).toBe("orion");
    expect(info.serverInfo.version).toBe("7.0.0");
    expect(info.capabilities.tools.listChanged).toBe(false);
  });

  it("falls back to the latest supported protocol version", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await call(server, "initialize", 1, {
      protocolVersion: "2099-01-01",
    });
    const info = res.result as { protocolVersion: string };
    expect(info.protocolVersion).toBe("2025-06-18");
  });

  it("responds to ping", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await call(server, "ping");
    expect(res.result).toEqual({});
  });

  it("rejects malformed JSON with -32700", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await server.handleMessage("{not json");
    expect((res as { error: { code: number } }).error.code).toBe(-32700);
  });

  it("rejects unknown methods with -32601", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await call(server, "nope");
    expect((res.error as { code: number }).code).toBe(-32601);
  });

  it("rejects unknown tools with -32601", async () => {
    const server = new McpServer([], "7.0.0");
    await call(server, "initialize");
    const res = await call(server, "tools/call", 2, { name: "nope" });
    expect((res.error as { code: number }).code).toBe(-32601);
  });

  it("does not respond to notifications (no id)", async () => {
    const server = new McpServer([], "7.0.0");
    const res = await server.handleMessage(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    );
    expect(res).toBeNull();
  });

  it("tools/list returns all registered tools with schemas", async () => {
    const server = new McpServer(getMcpTools(), "7.0.0");
    const res = await call(server, "tools/list");
    const list = (res.result as { tools: Array<{ name: string }> }).tools;
    const names = list.map((t) => t.name);
    expect(names).toContain("think");
    expect(names).toContain("forge");
    expect(names).toContain("shield");
    expect(names).toContain("metrics");
  });
});

describe("mcp: tool calls", () => {
  const makeServer = () => new McpServer(getMcpTools(), "7.0.0");

  it("tools/call think creates a proposal non-interactively", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "think",
      arguments: {
        prompt: "build a small parser",
        platform: "node",
        constraints: "zero deps",
        budget: "1m",
      },
    });
    expect(textOf(res)).toContain('"title"');
    expect(textOf(res)).toContain("build-a-small-parser");
    expect(textOf(res)).toContain('"platform": "node"');
  });

  it("tools/call think surfaces missing-prompt errors as isError", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "think",
      arguments: {},
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("requires a prompt");
  });

  it("tools/call shield fails honestly for a missing change (v0.10)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "shield",
      arguments: { changeId: "does-not-exist" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("tools/call out fails honestly for a missing change (v0.10)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "out",
      arguments: { changeId: "does-not-exist" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("tools/call draft fails honestly when the proposal is missing (v0.10)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "draft",
      arguments: { title: "ghost" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("no proposal");
  });

  it("tools/call track_status returns cache stats", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, { name: "track_status" });
    expect(textOf(res)).toContain('"count"');
  });

  it("tools/call scale dry preview works on a real file", async () => {
    mkdirSync("src", { recursive: true });
    writeFileSync(
      "src/a.ts",
      "export function add(a: number, b: number): number { return a + b; }\n",
      "utf8",
    );
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "scale",
      arguments: { file: "src/a.ts", dry: true },
    });
    expect(textOf(res)).toContain('"stages"');
    expect(textOf(res)).toContain('"final"');
  });

  it("tools/call version reports the toolkit version", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, { name: "version" });
    expect(textOf(res)).toContain('"version"');
  });

  it("logs tool activity to stderr when ORION_MCP_VERBOSE=1", async () => {
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      });
    process.env.ORION_MCP_VERBOSE = "1";
    try {
      const server = makeServer();
      const res = await call(server, "tools/call", 42, { name: "version" });
      expect(res).toMatchObject({ jsonrpc: "2.0", id: 42 });
      const log = writes.join("");
      expect(log).toContain("⚙ orion:version");
      expect(log).toContain("✅ orion:version done");
    } finally {
      spy.mockRestore();
      delete process.env.ORION_MCP_VERBOSE;
    }
  });

  it("announces the main argument for workflow tools", async () => {
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      });
    process.env.ORION_MCP_VERBOSE = "1";
    try {
      const server = makeServer();
      await call(server, "tools/call", 43, {
        name: "think",
        arguments: { prompt: "build a calculator" },
      });
      expect(writes.join("")).toContain('⚙ orion:think "build a calculator"');
    } finally {
      spy.mockRestore();
      delete process.env.ORION_MCP_VERBOSE;
    }
  });
});

describe("mcp: CLI wiring", () => {
  it("orion mcp --list prints the manifest", async () => {
    const { main } = await import("../src/cli/commands.js");
    expect(await main(["mcp", "--list"])).toBe(0);
  });
});

describe("mcp: compress tool (token economy)", () => {
  it("compresses command output and reports honest savings", async () => {
    const server = new McpServer(getMcpTools(), "7.0.0");
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "compress",
      arguments: {
        command: "vitest run",
        output: " RUN  v1.6.1\n ✓ a.test.ts (1 test) 2ms\n\n Test Files  1 passed (1)\n      Tests  1 passed (1)\n",
      },
    });
    const parsed = JSON.parse(textOf(res));
    expect(parsed.matched).toBe(true);
    expect(parsed.cached).toBe(false);
    expect(parsed.savedBytes).toBeGreaterThan(0);
    expect(parsed.out).toContain("1 passed (1)");
    expect(parsed.out).toContain("estimate");
  });

  it("serves repeated identical input from the cache (cached=true)", async () => {
    const server = new McpServer(getMcpTools(), "7.0.0");
    await call(server, "initialize");
    const args = {
      name: "compress",
      arguments: {
        command: "git status",
        output: [
          "On branch main",
          "\tmodified:   src/core/compress.ts",
          "\tmodified:   src/core/metrics.ts",
          "\tmodified:   src/core/mcp.ts",
          "\t?? new-file.ts",
        ].join("\n"),
      },
    };
    const a = JSON.parse(textOf(await call(server, "tools/call", 1, args)));
    const b = JSON.parse(textOf(await call(server, "tools/call", 2, args)));
    expect(a.cached).toBe(false);
    expect(a.matched).toBe(true);
    expect(b.cached).toBe(true);
    expect(b.out).toBe(a.out);
  });

  it("lists compress among the registered tools", async () => {
    const server = new McpServer(getMcpTools(), "7.0.0");
    const res = await call(server, "tools/list");
    const names = (res.result as { tools: Array<{ name: string }> }).tools.map(
      (t) => t.name,
    );
    expect(names).toContain("compress");
  });
});
