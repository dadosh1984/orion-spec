import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  stdin as processStdin,
  stdout as processStdout,
  stderr as processStderr,
} from "node:process";
import { think } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge, readTasks } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { nextStep } from "../skills/next/handler.js";
import { payDebt } from "../skills/pay-debt/handler.js";
import { resume } from "../skills/resume/handler.js";
import { applyScale, previewScale } from "./scale.js";
import { OrionTrack } from "./track.js";
import { metricsReport } from "./metrics.js";
import { compress } from "./compress.js";
import { listLessons } from "./lessons.js";
import { learnFromSessions, sessionFiles } from "./sessions.js";
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
  handler: (
    args: Record<string, unknown>,
    ctx?: ToolContext,
  ) => Promise<string>;
}

/**
 * Per-call context passed to tool handlers (v0.22). Lets long-running
 * tools emit MCP `notifications/progress` so the agent sees progress
 * instead of assuming the tool hung.
 */
export interface ToolContext {
  /** Emit a progress notification (absent when the client sent no token). */
  notify?: (p: { progress?: number; total?: number; message?: string }) => void;
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
    /** Client-supplied progress token (MCP spec: params._meta.progressToken). */
    _meta?: { progressToken?: number | string };
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

/**
 * Activity indicator: when an agent calls Orion tools over MCP, the user
 * sees what is running in the terminal. Logs go to stderr — stdout stays
 * protocol-clean. Disable with ORION_MCP_VERBOSE=0.
 */
function verboseEnabled(): boolean {
  return process.env.ORION_MCP_VERBOSE !== "0";
}

/** Short human-readable hint for the tool's main argument. */
function toolArgsHint(name: string, args: Record<string, unknown>): string {
  const main =
    args.prompt ?? args.title ?? args.changeId ?? args.file ?? args.slug;
  if (typeof main === "string" && main.trim().length > 0) {
    return `"${main.trim().slice(0, 60)}"`;
  }
  const s = JSON.stringify(args);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

function announceTool(name: string, args: Record<string, unknown>): void {
  processStderr.write(`⚙ orion:${name} ${toolArgsHint(name, args)}\n`);
}

function logToolDone(name: string): void {
  processStderr.write(`✅ orion:${name} done\n`);
}

function logToolFail(name: string, msg: string): void {
  processStderr.write(`❌ orion:${name} failed — ${msg.slice(0, 140)}\n`);
}

/** Print the change's task checklist (✓ = done) to stderr. */
function printChecklistStderr(title: string): void {
  const tasks = readTasks(title);
  if (tasks.length === 0) return;
  const done = tasks.filter((t) => t.done).length;
  processStderr.write(`  checklist ${title} (${done}/${tasks.length}):\n`);
  for (const t of tasks) {
    processStderr.write(`    ${t.done ? "✓" : "·"} ${t.text}\n`);
  }
}

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
        "Capture an idea as a proposal. Creates changes/<title>/proposal.json and caches it. Non-interactive: supply the three guided answers directly. BEFORE calling this tool, rephrase/refine the user's raw request into a clear, actionable goal (add the missing action verb, name the deliverable, resolve ambiguity) — if the request is ambiguous, ask the user clarifying questions first. The refined goal flows into draft, specs and tasks.",
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
      handler: async (args, ctx) => {
        const summary = await forge(String(args.title), {
          noCache: Boolean(args.noCache),
          onProgress: (done, total, message) =>
            ctx?.notify?.({ progress: done, total, message }),
        });
        return JSON.stringify(summary, null, 2);
      },
    },
    {
      name: "shield",
      description:
        "Run lint, type-check, tests, drift and security guard-rails against a change. Returns the guard report. Fails honestly (isError) when the change does not exist — a PASS for a missing change would be a lie.",
      inputSchema: {
        type: "object",
        properties: {
          changeId: { type: "string" },
          noCache: { type: "boolean" },
        },
        required: ["changeId"],
      },
      handler: async (args, ctx) => {
        const report = await shield(String(args.changeId), {
          noCache: Boolean(args.noCache),
          onProgress: (step, index, total) =>
            ctx?.notify?.({ progress: index, total, message: step }),
        });
        return JSON.stringify(report, null, 2);
      },
    },
    {
      name: "out",
      description:
        "Produce the final result.md summary for a change. Marks the guard verdict STALE when the change moved after the last shield run; fails honestly (isError) when the change does not exist.",
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
      name: "next_step",
      description:
        "Decide the next action to take: scans every change under changes/ and returns the highest-priority unfinished step (draft, forge, shield or out) plus a per-change status table. Call this when you are unsure what to do next.",
      inputSchema: {
        type: "object",
        properties: {},
      },
      handler: async () => {
        const r = await nextStep();
        return JSON.stringify(r, null, 2);
      },
    },
    {
      name: "pay_debt",
      description:
        "Repay yagni debt for a change without an LLM: re-run the SAME deterministic yagni signal shield uses, sync the debt ledger (snippets that no longer trigger the WARN are paid/closed, still-oversized ones stay owed), and report honestly with the numbers. Never deletes code and never fabricates a done — the payment tool is orion scale.",
      inputSchema: {
        type: "object",
        properties: {
          changeId: { type: "string", description: "Change id under changes/" },
          limit: {
            type: "number",
            description: "Max still-owed lines to report (default 5)",
          },
        },
        required: ["changeId"],
      },
      handler: async (args) => {
        const limit = Number(args.limit) > 0 ? Number(args.limit) : 5;
        const result = payDebt(String(args.changeId), limit);
        return JSON.stringify(result, null, 2);
      },
    },
    {
      name: "resume",
      description:
        "Continue an interrupted change workflow: read the checkpoint (or derive the phase from artifacts), then execute the phase's skill with the normal machinery — already-done tasks are skipped via the same forge:slug cache, nothing is re-done and nothing is fabricated as done.",
      inputSchema: {
        type: "object",
        properties: { changeId: { type: "string" } },
        required: ["changeId"],
      },
      handler: async (args) => {
        const r = await resume(String(args.changeId));
        return JSON.stringify(r, null, 2);
      },
    },
    {
      name: "compress",
      description:
        "Compress command output before it reaches the model context (token economy). Pass the command you ran and its raw stdout/stderr; returns the compressed text plus honest byte/token savings. Fail-safe: unmatched output is returned unchanged (matched=false). Repeated identical input is served from the OrionTrack cache (cached=true). Agent-agnostic — works from any MCP client.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command whose output this is, e.g. 'vitest run'",
          },
          output: { type: "string", description: "Raw stdout of the command" },
          stderr: { type: "string", description: "Raw stderr (optional)" },
          verbose: {
            type: "boolean",
            description: "Return raw output plus a note instead of compressing",
          },
        },
        required: ["command", "output"],
      },
      handler: async (args) => {
        const r = compress(
          String(args.command ?? ""),
          String(args.output ?? ""),
          String(args.stderr ?? ""),
          { verbose: Boolean(args.verbose) },
        );
        return JSON.stringify(r, null, 2);
      },
    },
    {
      name: "lessons_list",
      description:
        "List recorded self-correction lessons (changeId optional). Lessons are what Orion learned from its own errors — read them before acting so the same mistake is not repeated. Empty list is honest: nothing went wrong (yet).",
      inputSchema: {
        type: "object",
        properties: {
          changeId: {
            type: "string",
            description: "Filter lessons for one change (optional)",
          },
        },
      },
      handler: async (args) => {
        const changeId =
          typeof args.changeId === "string" && args.changeId.trim()
            ? args.changeId.trim()
            : undefined;
        return JSON.stringify(listLessons(changeId), null, 2);
      },
    },
    {
      name: "lessons_learn",
      description:
        "Learn from a JSONL agent session: detect recurring errors (an action failed, then the same action succeeded) and record them as lessons for the current project. Returns an honest report {files, records, actions, pairs, lessons, skipped} — an empty result means nothing was learned, not an error.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Session file (.jsonl) or directory of session files",
          },
        },
        required: ["path"],
      },
      handler: async (args) => {
        const target = typeof args.path === "string" ? args.path.trim() : "";
        if (!target) {
          throw new Error("lessons_learn requires a session file path");
        }
        const files = sessionFiles(target);
        if (files.length === 0) {
          throw new Error(`no *.jsonl session files found at ${target}`);
        }
        return JSON.stringify(learnFromSessions(files), null, 2);
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
          const preview = await previewScale(code, file);
          return JSON.stringify(preview, null, 2);
        }
        const scaled = await applyScale(code, { track, file });
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
        if (verboseEnabled()) announceTool(name, args);
        // Progress notifications (v0.22): when the client passes a progress
        // token in _meta, long tools stream notifications/progress lines
        // before the final result — the agent sees work happening instead
        // of blocking on silence.
        const progressToken = req.params?._meta?.progressToken;
        const ctx: ToolContext = {};
        if (progressToken !== undefined) {
          ctx.notify = (p) => {
            processStdout.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/progress",
                params: { progressToken, ...p },
              }) + "\n",
            );
          };
        }
        try {
          const text = await this.tools.get(name)!.handler(args, ctx);
          if (verboseEnabled()) {
            logToolDone(name);
            // Live checklist in the terminal: draft creates the plan,
            // forge ticks tasks off as they complete.
            if (name === "draft" || name === "forge") {
              const title = String(args.title ?? "");
              if (title) printChecklistStderr(title);
            }
          }
          return result(id, { content: [{ type: "text", text }] });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (verboseEnabled()) logToolFail(name, msg);
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
