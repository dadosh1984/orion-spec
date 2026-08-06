import { join } from "node:path";
import {
  listPlugins,
  installPlugin,
  removePlugin,
  scaffoldPlugin,
} from "../core/plugins.js";
import { CliOptions, printOut, fail } from "./helpers.js";

/** `orion plugin <sub>` — the plugin marketplace. */
export async function pluginCommand(
  args: string[],
  opts: CliOptions,
): Promise<number> {
  const [sub, target] = args;
  switch (sub) {
    case "new": {
      if (!target)
        return fail("plugin new requires a name, e.g. orion plugin new mytool");
      scaffoldPlugin(target);
      printOut(
        opts,
        {
          plugin: target,
          action: "scaffolded",
          dir: join(process.cwd(), target),
        },
        `Created plugin skeleton in ${join(process.cwd(), target)} — run \`orion plugin install ${target}\` to activate it`,
      );
      return 0;
    }
    case "install": {
      if (!target) return fail("plugin install requires a plugin directory");
      try {
        const info = installPlugin(target);
        printOut(
          opts,
          { plugin: info.name, version: info.version, location: info.dir },
          `Installed plugin ${info.name}@${info.version} (${info.commands.join(", ")})\n  ⚠ plugins run with full user privileges — install only code you trust`,
        );
        return 0;
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    }
    case "list": {
      const plugins = listPlugins();
      printOut(
        opts,
        { plugins },
        plugins.length
          ? plugins
              .map(
                (p) =>
                  `  • ${p.name}@${p.version} [${p.location}] — ${p.commands.join(", ")}${p.description ? ": " + p.description : ""}`,
              )
              .join("\n")
          : "No plugins installed. Try: orion plugin new demo && orion plugin install demo",
      );
      return 0;
    }
    case "remove": {
      if (!target) return fail("plugin remove requires a plugin name");
      const removed = removePlugin(target);
      if (!removed) return fail(`no plugin named "${target}"`);
      printOut(
        opts,
        { plugin: target, removed: true },
        `Removed plugin ${target}`,
      );
      return 0;
    }
    default:
      return fail(
        `unknown plugin sub-command "${sub ?? ""}" (new|install|list|remove)`,
      );
  }
}
