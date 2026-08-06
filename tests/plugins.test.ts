import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scaffoldPlugin,
  installPlugin,
  listPlugins,
  removePlugin,
  findPluginForCommand,
  loadPluginHandler,
  pluginDir,
  localPluginDir,
} from "../src/core/plugins.js";
import { main } from "../src/cli/commands.js";
import { OrionTrack } from "../src/core/track.js";

const ORIGINAL_CWD = process.cwd();
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "orion-plugins-"));
  process.chdir(dir);
  process.env.ORION_PLUGIN_DIR = join(dir, "global-plugins");
  process.env.ORION_CACHE_DIR = join(dir, "cache");
});

afterEach(() => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
});

/** Build a ready-to-install plugin named `name` in a temp folder. */
function makePlugin(name: string, command = name): string {
  const src = join(dir, `src-${name}`);
  mkdirSync(src, { recursive: true });
  writeFileSync(
    join(src, "manifest.json"),
    JSON.stringify({
      name,
      version: "0.1.0",
      description: `Test plugin ${name}`,
      commands: [command],
    }),
    "utf8",
  );
  writeFileSync(
    join(src, "index.js"),
    `export function run(args, ctx) {
      ctx.log(${JSON.stringify(`hello from ${name}`)} + " " + args.join(" "));
      return args.includes("--fail") ? 7 : 0;
    }`,
    "utf8",
  );
  return src;
}

describe("plugins: manager", () => {
  it("scaffoldPlugin writes manifest.json and index.js", () => {
    scaffoldPlugin("mytool");
    expect(existsSync(join(dir, "mytool", "manifest.json"))).toBe(true);
    expect(existsSync(join(dir, "mytool", "index.js"))).toBe(true);
    const manifest = JSON.parse(
      readFileSync(join(dir, "mytool", "manifest.json"), "utf8"),
    );
    expect(manifest.name).toBe("mytool");
    expect(manifest.commands).toEqual(["mytool"]);
  });

  it("installPlugin copies a plugin dir and listPlugins reports it", () => {
    installPlugin(makePlugin("demo"));
    const plugins = listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      name: "demo",
      version: "0.1.0",
      commands: ["demo"],
      location: "global",
    });
  });

  it("installPlugin rejects a directory without a manifest", () => {
    mkdirSync(join(dir, "nomanifest"), { recursive: true });
    expect(() => installPlugin(join(dir, "nomanifest"))).toThrow(
      "requires a directory with manifest.json",
    );
  });

  it("local plugins take precedence over global ones", () => {
    installPlugin(makePlugin("demo"));
    // local override with the same name
    const local = join(dir, ".orion", "plugins", "demo");
    mkdirSync(local, { recursive: true });
    writeFileSync(
      join(local, "manifest.json"),
      JSON.stringify({
        name: "demo",
        version: "9.9.9",
        description: "local override",
        commands: ["demo"],
      }),
      "utf8",
    );
    writeFileSync(
      join(local, "index.js"),
      "export function run(){return 0;}",
      "utf8",
    );
    const plugins = listPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].version).toBe("9.9.9");
    expect(plugins[0].location).toBe("local");
  });

  it("removePlugin deletes the plugin and reports success", () => {
    installPlugin(makePlugin("demo"));
    expect(removePlugin("demo")).toBe(true);
    expect(removePlugin("demo")).toBe(false);
    expect(listPlugins()).toEqual([]);
  });

  it("findPluginForCommand matches manifest commands", () => {
    installPlugin(makePlugin("demo", "demo-cmd"));
    const found = findPluginForCommand("demo-cmd");
    expect(found?.name).toBe("demo");
    expect(findPluginForCommand("missing")).toBeNull();
  });

  it("pluginDir/localPluginDir honor env and cwd", () => {
    expect(pluginDir()).toBe(join(dir, "global-plugins"));
    expect(localPluginDir()).toBe(join(dir, ".orion", "plugins"));
  });

  it("readManifest tolerates missing/invalid manifests", async () => {
    const { readManifest } = await import("../src/core/plugins.js");
    expect(readManifest(join(dir, "absent"))).toBeNull();
    mkdirSync(join(dir, "bad"), { recursive: true });
    writeFileSync(join(dir, "bad", "manifest.json"), "{not json", "utf8");
    expect(readManifest(join(dir, "bad"))).toBeNull();
    writeFileSync(join(dir, "bad", "manifest.json"), "{}", "utf8");
    expect(readManifest(join(dir, "bad"))).toBeNull();
  });

  it("loadPluginHandler rejects a plugin without a run handler", async () => {
    const src = join(dir, "broken");
    mkdirSync(src, { recursive: true });
    writeFileSync(
      join(src, "manifest.json"),
      JSON.stringify({
        name: "broken",
        version: "0.0.1",
        commands: ["broken"],
      }),
      "utf8",
    );
    writeFileSync(join(src, "index.js"), "export const nothing = 1;", "utf8");
    const info = installPlugin(src);
    await expect(loadPluginHandler(info)).rejects.toThrow(
      "no run(args, ctx) handler",
    );
  });
});

describe("plugins: dispatch", () => {
  it("loadPluginHandler calls run with args and ctx", async () => {
    const src = makePlugin("hello");
    const info = installPlugin(src);
    const handler = await loadPluginHandler(info);
    let logged = "";
    const code = await handler(["world"], {
      track: OrionTrack.init(),
      cwd: dir,
      options: {
        noCache: false,
        dry: false,
        watch: false,
        json: false,
        port: 0,
        ui: true,
      },
      log: (m) => (logged = m),
    });
    expect(code).toBe(0);
    expect(logged).toBe("hello from hello world");
  });

  it("main dispatches an unknown command to an installed plugin", async () => {
    installPlugin(makePlugin("greet"));
    const code = await main(["greet", "mars"]);
    expect(code).toBe(0);
  });

  it("main propagates plugin exit codes", async () => {
    installPlugin(makePlugin("greet"));
    expect(await main(["greet", "--fail"])).toBe(7);
  });

  it("main still reports unknown commands when no plugin matches", async () => {
    expect(await main(["no-such-command"])).toBe(1);
  });

  it("plugin list / install / remove sub-commands via main", async () => {
    const src = makePlugin("cycle");
    expect(await main(["plugin", "install", src])).toBe(0);
    expect(await main(["plugin", "list"])).toBe(0);
    expect(await main(["plugin", "remove", "cycle"])).toBe(0);
    expect(await main(["plugin", "remove", "cycle"])).toBe(1);
  });

  it("plugin new scaffolds into cwd", async () => {
    expect(await main(["plugin", "new", "fresh"])).toBe(0);
    expect(existsSync(join(dir, "fresh", "manifest.json"))).toBe(true);
  });

  it("plugin commands require arguments", async () => {
    expect(await main(["plugin", "install"])).toBe(1);
    expect(await main(["plugin", "new"])).toBe(1);
    expect(await main(["plugin", "remove"])).toBe(1);
  });
});
