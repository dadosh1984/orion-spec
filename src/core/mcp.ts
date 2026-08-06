import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { think } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { applyScale, previewScale } from "./scale.js";
import { OrionTrack } from "./track.js";
import { metricsReport } from "./metrics.js";
import { listPlugins, installPlugin, removePlugin } from "./plugins.js";
import { readVersion } from "../cli/serve.js";

/**
 * Orion MCP server — a zero-dependency implementation of the Model Context
 * Protocol (JSON-RPC 2.0 over stdio). Any MCP-capable AI agent (Claude Code,
 * Codex, opencode, Cursor, Cline, Continue, Gemini CLI, Goose, …) can attach
 * to it via `orion mcp` and call think/draft/forge/shield/scale/track/metrics
 * as native tools.
 */

/** MCP protocol versions this server understands. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
];

/** A single MCP tool exposed to agents. */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

/** JSON-RPC request received from the agent. */
interface RpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
    protocolVersion?: string;
  };
}

/** Result of handling one message: a response line, or null for notifications. */
export interface McpResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** JSON-RPC error codes (per spec). */
const ERRORS = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  NOT_INITIALIZED: -32002,
} as const;

function error(
  code: number,
  message: string,
  id: number | string | null,
): McpResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function result(id: number | string | null, value: unknown): McpResponse {
  return { jsonrpc: "2.0", id, result: value };
}

/** JSON-RPC error body for methods not found / invalid requests. */
function jsonRpcError(code: number, message: string): McpResponse {
  return { jsonrpc: "2.0", id: null, error: { code, message } };
}

/** Build the full tool registry. */
export function getMcpTools(): McpTool[] {
  return [
    {
      name: "think",
      description:
        "Capture an idea as a proposal. Creates changes/<title>/proposal.json and caches it. Non-interactive: supply the three guided answers directly.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The idea to develop" },
          platform: {
            type: "string",
            description: "Target platform (optional)",
          },
          constraints: {
            type: "string",
            description: "Constraints (optional)",
          },
          budget: {
            type: "string",
            description: "Token/time budget (optional)",
          },
        },
        required: ["prompt"],
      },
      handler: async (args) => {
        const prompt = String(args.prompt ?? "");
        if (!prompt.trim()) throw new Error("think requires a prompt");
        const answers = [args.platform, args.constraints, args.budget].map(
          (a) => (typeof a === "string" ? a : ""),
        );
        let i = 0;
        const proposal = await think(prompt, {}, async () => {
          const next = answers[Math.min(i, answers.length - 1)] ?? "";
          i++;
          return next;
        });
        return JSON.stringify(proposal, null, 2);
      },
    },
    {
      name: "draft",
      description:
        "Generate design.md, specs/, tasks.md from an existing proposal (from think).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Proposal title (from think)" },
          noCache: { type: "boolean", description: "Bypass cache" },
        },
        required: ["title"],
      },
      handler: async (args) => {
        const set = await draft(String(args.title), {
          noCache: Boolean(args.noCache),
        });
        return JSON.stringify(set, null, 2);
      },
    },
    {
      name: "forge",
      description:
        "Drive every open task in tasks.md through RED-GREEN-REFACTOR using snippets from changes/<title>/snippets/.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          noCache: { type: "boolean" },
        },
        required: ["title"],
      },
      handler: async (args) => {
        const summary = await forge(String(args.title), {
          noCache: Boolean(args.noCache),
        });
        return JSON.stringify(summary, null, 2);
      },
    },
    {
      name: "shield",
      description:
        "Run lint, type-check, tests, drift and security guard-rails against a change. Returns the guard report.",
      inputSchema: {
        type: "object",
        properties: {
          changeId: { type: "string" },
          noCache: { type: "boolean" },
        },
        required: ["changeId"],
      },
      handler: async (args) => {
        const report = await shield(String(args.changeId), {
          noCache: Boolean(args.noCache),
        });
        return JSON.stringify(report, null, 2);
      },
    },
    {
      name: "out",
      description: "Produce the final result.md summary for a change.",
      inputSchema: {
        type: "object",
        properties: { changeId: { type: "string" } },
        required: ["changeId"],
      },
      handler: async (args) => {
        const r = await out(String(args.changeId));
        return JSON.stringify(r, null, 2);
      },
    },
    {
      name: "scale",
      description:
        "Apply the YAGNI ladder to a source file. dry=true returns a diff preview without writing; otherwise writes <file>.scaled.ts and returns the result.",
      inputSchema: {
        type: "object",
        properties: {
          file: { type: "string", description: "Path to the .ts file" },
          dry: { type: "boolean", description: "Preview only" },
        },
        required: ["file"],
      },
      handler: async (args) => {
        const file = String(args.file);
        const dry = Boolean(args.dry);
        if (!existsSync(file)) throw new Error(`file not found: ${file}`);
        const code = readFileSync(file, "utf8");
        const track = OrionTrack.init();
        if (dry) {
          const preview = await previewScale(code);
          return JSON.stringify(preview, null, 2);
        }
        const scaled = await applyScale(code, { track });
        const outFile = file.replace(/\.ts$/, ".scaled.ts");
        writeFileSync(outFile, scaled, "utf8");
        return JSON.stringify({ file: outFile, result: scaled }, null, 2);
      },
    },
    {
      name: "track_status",
      description: "Cache statistics: entry count, bytes, last write.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const track = OrionTrack.init();
        return JSON.stringify(
          { cache: track.getStats(), config: track.config() },
          null,
          2,
        );
      },
    },
    {
      name: "track_prune",
      description: "Remove expired / oversized cache entries.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const removed = OrionTrack.init().prune();
        return JSON.stringify({ removed }, null, 2);
      },
    },
    {
      name: "metrics",
      description:
        "Benchmark report: cold/hot ladder timings plus token budget by cache namespace.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const report = await metricsReport(OrionTrack.init(), readVersion());
        return JSON.stringify(report, null, 2);
      },
    },
    {
      name: "plugin_list",
      description: "List installed plugins.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => JSON.stringify(listPlugins(), null, 2),
    },
    {
      name: "plugin_install",
      description:
        "Install a plugin from a directory (must contain manifest.json).",
      inputSchema: {
        type: "object",
        properties: { source: { type: "string" } },
        required: ["source"],
      },
      handler: async (args) => {
        const info = installPlugin(String(args.source));
        return JSON.stringify(info, null, 2);
      },
    },
    {
      name: "plugin_remove",
      description: "Uninstall a plugin by name.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      handler: async (args) => {
        const ok = removePlugin(String(args.name));
        if (!ok) throw new Error(`no plugin named "${args.name}"`);
        return JSON.stringify({ removed: args.name }, null, 2);
      },
    },
    {
      name: "version",
      description: "Orion version.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => JSON.stringify({ version: readVersion() }, null, 2),
    },
  ];
}

/**
 * MCP server over stdio. Zero runtime dependencies: one JSON-RPC 2.0
 * message per line, logs go to stderr so stdout stays protocol-clean.
 */
export class McpServer {
  private readonly tools = new Map<string, McpTool>();
  private initialized = false;

  constructor(
    tools: McpTool[] = getMcpTools(),
    private readonly version = readVersion(),
  ) {
    for (const tool of tools) this.tools.set(tool.name, tool);
  }

  /** Handle one raw JSON-RPC message. Returns a response or null (notifications). */
  async handleMessage(raw: string): Promise<McpResponse | null> {
    let req: RpcRequest;
    try {
      req = JSON.parse(raw) as RpcRequest;
    } catch {
      return jsonRpcError(ERRORS.PARSE, "Parse error");
    }
    if (req.jsonrpc !== "2.0" || typeof req.method !== "string") {
      return jsonRpcError(ERRORS.INVALID_REQUEST, "Invalid Request");
    }
    const id: number | string | null = req.id ?? null;
    const method = req.method;

    // Notifications carry no id — per spec we must not respond.
    if (req.id === undefined || req.id === null) {
      // "initialized" marks readiness; nothing else needed.
      return null;
    }

    switch (method) {
      case "initialize": {
        const requested =
          (req.params?.protocolVersion as string | undefined) ??
          SUPPORTED_PROTOCOL_VERSIONS.at(-1)!;
        const protocolVersion =
          requested && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : SUPPORTED_PROTOCOL_VERSIONS.at(-1)!;
        this.initialized = true;
        return result(id, {
          protocolVersion,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: { name: "orion", version: this.version },
        });
      }
      case "ping":
        return result(id, {});
      case "tools/list":
        return result(id, {
          tools: [...this.tools.values()].map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });
      case "tools/call": {
        const name = req.params?.name;
        if (!name || !this.tools.has(name)) {
          return error(ERRORS.METHOD_NOT_FOUND, `Unknown tool: ${name}`, id);
        }
        const args = req.params?.arguments ?? {};
        try {
          const text = await this.tools.get(name)!.handler(args);
          return result(id, { content: [{ type: "text", text }] });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return result(id, {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          });
        }
      }
      case "resources/list":
        return result(id, { resources: [] });
      case "prompts/list":
        return result(id, { prompts: [] });
      default:
        if (!this.initialized && method.startsWith("tools/")) {
          return error(ERRORS.NOT_INITIALIZED, "Server not initialized", id);
        }
        return error(
          ERRORS.METHOD_NOT_FOUND,
          `Method not found: ${method}`,
          id,
        );
    }
  }

  /** Drive the stdio loop until EOF. */
  async runStdio(): Promise<void> {
    const rl = createInterface({
      input: processStdin,
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const response = await this.handleMessage(line);
        if (response) processStdout.write(JSON.stringify(response) + "\n");
      } catch {
        // Never let an internal failure corrupt the protocol stream.
        processStdout.write(
          JSON.stringify(jsonRpcError(ERRORS.INTERNAL, "Internal error")) +
            "\n",
        );
      }
    }
  }
}

/** Machine-readable tool manifest for `orion mcp --list` / docs. */
export function toolManifest(): unknown {
  return {
    protocol: "model-context-protocol",
    versions: SUPPORTED_PROTOCOL_VERSIONS,
    transport: "stdio",
    tools: getMcpTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
}
