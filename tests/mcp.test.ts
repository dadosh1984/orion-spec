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
import { listLessons } from "../src/core/lessons.js";
import { shield } from "../src/skills/shield/handler.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-mcp-"));
  process.chdir(dir);
  process.env.ORION_CACHE_DIR = join(dir, "cache");
  process.env.ORION_LESSONS_FILE = join(dir, "lessons.json");
  process.env.ORION_PROFILE_FILE = join(dir, "profile.md");
  process.env.ORION_ECONOMY_FILE = join(dir, "economy.json");
  process.env.ORION_SHIELD_SKIP_SHELL = "1";
});

afterEach(() => {
  delete process.env.ORION_CACHE_DIR;
  delete process.env.ORION_LESSONS_FILE;
  delete process.env.ORION_ECONOMY_FILE;
  delete process.env.ORION_PROFILE_FILE;
  delete process.env.ORION_SHIELD_SKIP_SHELL;
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

function makeServer(): McpServer {
  return new McpServer(getMcpTools(), "7.0.0");
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
    expect(names).toContain("pay_debt");
    expect(names).toContain("resume");
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
    expect(textOf(res)).toContain("small-parser");
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

  it("tools/call out returns the human-readable markdown summary (not JSON)", async () => {
    mkdirSync(join(dir, "changes/demo"), { recursive: true });
    writeFileSync(
      join(dir, "changes/demo/proposal.json"),
      JSON.stringify({ goal: "demo" }),
    );
    writeFileSync(join(dir, "changes/demo/tasks.md"), "");
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "out",
      arguments: { changeId: "demo" },
    });
    const text = textOf(res);
    expect(text).toContain("# Result — demo");
    expect(text).not.toContain('"changeId"');
  });

  it("tools/call profile returns the user-adaptation profile (v0.26)", async () => {
    writeFileSync(
      join(dir, "profile.md"),
      "# Orion user profile\n\n## Auto (updated by Orion)\n- Language: ru\n- Platform: (not yet observed)\n- Budget: (not yet observed)\n- Frequent topics: (none yet)\n\n## User notes\n\nПишите кратко.\n",
    );
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "profile",
      arguments: {},
    });
    const text = textOf(res);
    expect(text).toContain("# Orion user profile");
    expect(text).toContain("Language: ru");
    expect(text).toContain("## User notes");
  });

  it("tools/call pay_debt fails honestly for a missing change (v0.22)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "pay_debt",
      arguments: { changeId: "does-not-exist" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("tools/call resume fails honestly for a missing change (v0.22)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "resume",
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

describe("mcp: progress notifications (v0.22)", () => {
  it("streams notifications/progress when the client sends a progress token", async () => {
    mkdirSync(join("changes", "demo"), { recursive: true });
    writeFileSync(
      join("changes", "demo", "proposal.json"),
      JSON.stringify({ title: "demo", goal: "build demo" }),
      "utf8",
    );
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const server = new McpServer();
    const res = await call(server, "tools/call", 7, {
      name: "shield",
      arguments: { changeId: "demo" },
      _meta: { progressToken: 42 },
    });
    const progress = writes.filter((w) => w.includes("notifications/progress"));
    // Every guard-rail step produced a progress line before the result.
    expect(progress.length).toBeGreaterThanOrEqual(3);
    const first = JSON.parse(progress[0]) as {
      jsonrpc: string;
      method: string;
      params: { progressToken: number; progress: number; total: number };
    };
    expect(first.jsonrpc).toBe("2.0");
    expect(first.method).toBe("notifications/progress");
    expect(first.params.progressToken).toBe(42);
    expect(first.params.progress).toBe(1);
    expect(first.params.total).toBeGreaterThanOrEqual(8);
    // The final result line is a response, not a notification.
    expect(textOf(res)).toContain('"changeId": "demo"');
  });

  it("emits no notifications without a progress token (backward compatible)", async () => {
    mkdirSync(join("changes", "demo2"), { recursive: true });
    writeFileSync(
      join("changes", "demo2", "proposal.json"),
      JSON.stringify({ title: "demo2", goal: "build demo2" }),
      "utf8",
    );
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const server = new McpServer();
    await call(server, "tools/call", 8, {
      name: "shield",
      arguments: { changeId: "demo2" },
    });
    expect(writes.filter((w) => w.includes("notifications/progress"))).toEqual(
      [],
    );
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
        output:
          " RUN  v1.6.1\n ✓ a.test.ts (1 test) 2ms\n\n Test Files  1 passed (1)\n      Tests  1 passed (1)\n",
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

describe("mcp: lessons_learn tool (session learning, v0.13)", () => {
  it("learns lessons from a session file and reports honestly", async () => {
    writeFileSync(
      join("sess.jsonl"),
      [
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "a",
                name: "bash",
                arguments: { command: "pnpm test" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "a",
            toolName: "bash",
            content: [{ type: "text", text: "Error: 2 tests failed" }],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "assistant",
            content: [
              {
                type: "toolCall",
                id: "b",
                name: "bash",
                arguments: { command: "pnpm test --runInBand" },
              },
            ],
          },
        }),
        JSON.stringify({
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "b",
            toolName: "bash",
            content: [{ type: "text", text: "Test Files 3 passed" }],
          },
        }),
      ].join("\n"),
      "utf8",
    );
    const server = new McpServer(getMcpTools(), "7.0.0");
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "lessons_learn",
      arguments: { path: "sess.jsonl" },
    });
    const text = textOf(res);
    expect(text).toContain('"lessons": 1');
    expect(text).toContain('"pairs": 1');
    expect(listLessons().some((l) => l.step === "session")).toBe(true);
  });

  it("isError on a missing path (honesty)", async () => {
    const server = new McpServer(getMcpTools(), "7.0.0");
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "lessons_learn",
      arguments: { path: "nope.jsonl" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no \*\.jsonl session files/);
  });
});

describe("MCP protocol edge cases (v0.25 coverage)", () => {
  it("returns a parse error for invalid JSON", async () => {
    const server = makeServer();
    const res = await server.handleMessage("{broken");
    expect(res?.error?.code).toBe(-32700);
  });

  it("returns invalid-request for a non-JSON-RPC body", async () => {
    const server = makeServer();
    const res = await server.handleMessage(JSON.stringify({ hello: 1 }));
    expect(res?.error?.code).toBe(-32600);
  });

  it("ignores notifications (no id) per the spec", async () => {
    const server = makeServer();
    const res = await server.handleMessage(
      JSON.stringify({ jsonrpc: "2.0", method: "initialized" }),
    );
    expect(res).toBeNull();
  });

  it("serves resources/list and prompts/list (v0.27 real payloads)", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const r1 = await call(server, "resources/list", 1);
    expect((r1.result as { resources: unknown[] }).resources).toBeDefined();
    const r2 = await call(server, "prompts/list", 1);
    const prompts = (r2.result as { prompts: Array<{ name: string }> }).prompts;
    expect(prompts.map((p) => p.name)).toContain("review");
    expect(prompts.map((p) => p.name)).toContain("resume");
  });

  it("is lenient with tools/call before initialize (compat, v0.25)", async () => {
    // The server does not hard-fail tools/call pre-init — some clients
    // probe tools early; the result is served regardless.
    const server = makeServer();
    const res = await call(server, "tools/call", 1, {
      name: "version",
      arguments: {},
    });
    expect((res.result as { content: unknown[] }).content).toBeDefined();
  });

  it("reports tool errors as isError results, not thrown exceptions", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "tools/call", 1, {
      name: "lessons_learn",
      arguments: { path: "no-such-session.jsonl" },
    });
    const result = res.result as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("no *.jsonl");
  });
});

describe("MCP protocol defaults (v0.25)", () => {
  it("unknown methods after init yield METHOD_NOT_FOUND", async () => {
    const server = makeServer();
    await call(server, "initialize");
    const res = await call(server, "bogus/method", 1);
    expect(res.error?.code).toBe(-32601);
  });

  it("initialize negotiates any protocol version", async () => {
    const server = makeServer();
    const res = await call(server, "initialize", 1, {
      protocolVersion: "9999.0.0",
      capabilities: {},
      clientInfo: { name: "t", version: "1" },
    });
    // Negotiation: the server answers with the highest version it supports.
    expect((res.result as { protocolVersion: string }).protocolVersion).toBe(
      "2025-06-18",
    );
  });
});

describe("mcp: stdio loop (v0.25)", () => {
  it("runStdio answers each line and exits at EOF", async () => {
    const { Readable } = await import("node:stream");
    const lines = [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }),
      "   ",
      "",
    ];
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    const server = new McpServer();
    await server.runStdio(Readable.from(lines.map((l) => l + "\n")));
    vi.restoreAllMocks();
    const answers = writes.filter((w) => w.includes('"jsonrpc"'));
    expect(answers).toHaveLength(2);
    expect(JSON.parse(answers[1])).toMatchObject({ id: 2, result: {} });
  });
});
