import { homedir } from "node:os";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";
import type { OrionTrack } from "./track.js";
import type { CliOptions } from "../cli/commands.js";

/** Manifest describing a plugin's name, version and exposed commands. */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  commands?: string[];
}

/** Runtime context handed to plugin command handlers. */
export interface PluginContext {
  track: OrionTrack;
  cwd: string;
  options: CliOptions;
  log: (message: string) => void;
}

/** A discovered plugin (global or local directory). */
export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  commands: string[];
  location: "global" | "local";
  dir: string;
}

const DEFAULT_PLUGIN_DIR = join(homedir(), ".orion", "plugins");

/** Global plugin directory; overridable via ORION_PLUGIN_DIR (tests). */
export function pluginDir(): string {
  return process.env.ORION_PLUGIN_DIR ?? DEFAULT_PLUGIN_DIR;
}

/** Project-local plugin directory (takes precedence over global). */
export function localPluginDir(): string {
  return join(process.cwd(), ".orion", "plugins");
}

/** Parse a plugin manifest; returns null when invalid. */
export function readManifest(dir: string): PluginManifest | null {
  const file = join(dir, "manifest.json");
  if (!existsSync(file)) return null;
  try {
    const raw = JSON.parse(readFileSync(file, "utf8")) as PluginManifest;
    if (typeof raw.name !== "string" || typeof raw.version !== "string") {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** List plugins from a single directory, oldest manifest-first. */
function listIn(dir: string, location: "global" | "local"): PluginInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dirPath = join(dir, entry.name);
      const manifest = readManifest(dirPath);
      if (!manifest) return null;
      return {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description ?? "",
        commands: manifest.commands ?? [manifest.name],
        location,
        dir: dirPath,
      };
    })
    .filter((p): p is PluginInfo => p !== null);
}

/** All installed plugins: local first, then global (deduped by name). */
export function listPlugins(): PluginInfo[] {
  const seen = new Set<string>();
  const result: PluginInfo[] = [];
  for (const info of [
    ...listIn(localPluginDir(), "local"),
    ...listIn(pluginDir(), "global"),
  ]) {
    if (seen.has(info.name)) continue;
    seen.add(info.name);
    result.push(info);
  }
  return result;
}

/** Find a plugin that exposes a command with the given name. */
export function findPluginForCommand(command: string): PluginInfo | null {
  return listPlugins().find((p) => p.commands.includes(command)) ?? null;
}

/** Copy a plugin directory into the global plugin dir (must have a manifest). */
export function installPlugin(source: string): PluginInfo {
  const manifest = readManifest(source);
  if (!manifest) {
    throw new Error(`plugin install requires a directory with manifest.json`);
  }
  const target = join(pluginDir(), basename(source));
  mkdirSync(pluginDir(), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  // Mark the plugin as ESM so Node doesn't warn/reparse the handler.
  if (!existsSync(join(target, "package.json"))) {
    writeFileSync(
      join(target, "package.json"),
      JSON.stringify(
        { name: manifest.name, version: manifest.version, type: "module" },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? "",
    commands: manifest.commands ?? [manifest.name],
    location: "global",
    dir: target,
  };
}

/** Remove a plugin from the global (or local) plugin dir. */
export function removePlugin(name: string): boolean {
  const info = listPlugins().find((p) => p.name === name);
  if (!info) return false;
  rmSync(info.dir, { recursive: true, force: true });
  return true;
}

/** Scaffold a minimal plugin skeleton in the current directory. */
export function scaffoldPlugin(name: string): void {
  const dir = join(process.cwd(), name);
  mkdirSync(dir, { recursive: true });
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "-");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        name: safeName,
        version: "0.1.0",
        description: `orion plugin: ${safeName}`,
        commands: [safeName],
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  writeFileSync(
    join(dir, "index.js"),
    `// ${safeName} — orion plugin\n// Export one handler per command listed in manifest.json.\nexport async function run(args, ctx) {\n  ctx.log(\`${safeName}: received \${args.length} arg(s)\`);\n  return 0;\n}\n`,
    "utf8",
  );
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      { name: safeName, version: "0.1.0", type: "module" },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

/** Load a plugin's command handler (dynamic ESM import). */
export async function loadPluginHandler(
  info: PluginInfo,
): Promise<(args: string[], ctx: PluginContext) => number | Promise<number>> {
  const url = pathToFileURL(join(info.dir, "index.js")).href;
  const mod = (await import(url)) as {
    run?: (args: string[], ctx: PluginContext) => number | Promise<number>;
    default?: (args: string[], ctx: PluginContext) => number | Promise<number>;
  };
  const handler = mod.run ?? mod.default;
  if (typeof handler !== "function") {
    throw new Error(`plugin "${info.name}" has no run(args, ctx) handler`);
  }
  return handler;
}
