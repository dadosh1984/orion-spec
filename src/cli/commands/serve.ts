/**
 * `orion serve` (v0.51) — web UI dashboard + MCP server.
 *
 * Replaces the deprecated top-level `serve` and `mcp` commands.
 *
 * Usage:
 *   orion serve                Start the web dashboard (default)
 *   orion serve mcp            Start the MCP server (for AI agents)
 *   orion serve --port N       Custom port (default 4780)
 *   orion serve --host H       Custom host (default 127.0.0.1)
 *   orion serve --token T      Bearer token (auto-generated on non-loopback)
 *   orion serve --ui           Serve the HTML dashboard at /
 */
import { DEFAULT_PORT } from "../../constants.js";
import { startServer } from "../serve.js";
import { McpServer, toolManifest } from "../../core/mcp.js";
import type { CommandHandler } from "../registry.js";

export const serveHandler: CommandHandler = async (args, opts) => {
  // `orion serve mcp` — start MCP server (stdio JSON-RPC).
  if (args[0] === "mcp") {
    const tools = toolManifest() as Array<{ name: string }>;
    const server = new McpServer();
    console.log(`orion MCP server starting (tools: ${tools.length})`);
    await server.runStdio();
    return 0;
  }

  // `orion serve` — start web dashboard.
  const port = opts.port > 0 ? opts.port : DEFAULT_PORT;
  const host = opts.host ?? "127.0.0.1";
  const token = opts.token;

  // Auto-generate token on non-loopback bind.
  let finalToken = token;
  if (!finalToken && host !== "127.0.0.1" && host !== "localhost") {
    const { randomBytes } = await import("node:crypto");
    finalToken = randomBytes(16).toString("hex");
    console.log(`[orion] non-loopback bind, generated token: ${finalToken}`);
  }

  const { OrionTrack } = await import("../../core/track.js");
  await startServer(OrionTrack.init(), {
    port,
    host,
    token: finalToken,
    ui: opts.ui,
  });
  return 0;
};
