import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { statusMark, paint } from "../utils/term.js";
import {
  listScripts,
  createScript,
  runScript as runScriptCore,
  deleteScript,
  setSchedule,
  readManifest,
  scriptPath,
} from "../core/runtime.js";
import { listCacheEntries } from "../core/specCache.js";

/**
 * `orion run` (v0.39) — автономные локальные скрипты.
 */
export function runDispatch(args: string[]): number {
  const sub = args[0];
  const name = args[1];
  const rest = args.slice(2);

  if (!sub) return runList();

  switch (sub) {
    case "list":
      return runList();

    case "cache": {
      const entries = listCacheEntries();
      if (entries.length === 0) {
        console.log(`${statusMark("info")} Spec cache is empty.`);
      } else {
        console.log(`${statusMark("info")} Spec cache (${entries.length} entries):`);
        for (const e of entries) {
          console.log(`  ${e.key.padEnd(18)} → ${e.scriptName.padEnd(20)} ×${e.hitCount}  last: ${new Date(e.lastHit).toLocaleDateString()}`);
        }
      }
      return 0;
    }

    case "new": {
      if (!name) return fail("usage: orion run new <name>");
      const desc = rest.join(" ") || "No description";
      try {
        const m = createScript(name, "bash", desc);
        console.log(`${statusMark("done")} Script created: ${m.name}`);
        console.log(`  Runtime: ${m.runtime}`);
        console.log(`  Path:    ${scriptPath(name)}`);
        console.log(`  Edit:    orion run edit ${name}`);
      } catch (err) {
        console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      return 0;
    }

    case "show": {
      if (!name) return fail("run show requires a script name");
      const m = readManifest(name);
      if (!m) { console.error(`orion: script "${name}" not found`); return 1; }
      const code = existsSync(scriptPath(name))
        ? readFileSync(scriptPath(name), "utf8") : "(missing)";
      console.log([
        `${statusMark("info")} Script: ${name}`,
        `  Description: ${m.description}`,
        `  Runtime: ${m.runtime}  |  Runs: ${m.runCount}  |  Last: ${m.lastRun ?? "never"}`,
        `  Schedule: ${m.schedule ?? "none"}`,
        m.sourceChange ? `  Source: change "${m.sourceChange}"` : "",
        "", "---", code.trimEnd(),
      ].filter((l) => l !== "").join("\n"));
      return 0;
    }

    case "edit": {
      if (!name) return fail("run edit requires a script name");
      if (!readManifest(name)) { console.error(`orion: script "${name}" not found`); return 1; }
      const editor = process.env.EDITOR || process.env.VISUAL || "vi";
      try { execSync(`${editor} "${scriptPath(name)}"`, { stdio: "inherit" }); } catch { /* ok */ }
      return 0;
    }

    case "delete": {
      if (!name) return fail("run delete requires a script name");
      try { deleteScript(name); console.log(`${statusMark("done")} "${name}" deleted`); }
      catch (err) { console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`); return 1; }
      return 0;
    }

    case "schedule": {
      if (!name || !rest.length) return fail("run schedule requires: name cron-expr");
      try { setSchedule(name, rest.join(" ")); console.log(`${statusMark("done")} "${name}" scheduled: ${rest.join(" ")}`); }
      catch (err) { console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`); return 1; }
      return 0;
    }

    case "unschedule": {
      if (!name) return fail("run unschedule requires a script name");
      try { setSchedule(name, null); console.log(`${statusMark("done")} "${name}" unscheduled`); }
      catch (err) { console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`); return 1; }
      return 0;
    }

    case "scheduled": {
      const sched = listScripts().filter((m) => m.schedule);
      if (sched.length === 0) { console.log(`${statusMark("info")} No scheduled scripts.`); return 0; }
      console.log(`${statusMark("info")} Scheduled (${sched.length}):`);
      for (const m of sched) console.log(`  ${m.name.padEnd(20)} ${m.schedule}`);
      return 0;
    }

    default: {
      const m = readManifest(sub);
      if (!m) return fail(`unknown subcommand or script "${sub}" not found.\n  Usage: orion run [list|new|show|edit|delete|schedule|unschedule|scheduled|cache|<name>]`);
      const force = rest.includes("--force");
      const result = runScriptCore(sub, { force });
      if (result.ok) {
        process.stdout.write(result.output);
        console.error(`\n${paint(`✓ ${sub} — ${result.durationMs}ms`, "dim")}`);
      } else {
        console.error(`\n${statusMark("error")} ${result.output}`);
        return 1;
      }
      return 0;
    }
  }
}

function runList(): number {
  const scripts = listScripts();
  if (scripts.length === 0) {
    console.log(`${statusMark("info")} No scripts yet.\n  Create: orion run new my-task`);
    return 0;
  }
  console.log(`${statusMark("info")} Scripts (${scripts.length}):`);
  for (const m of scripts) {
    const last = m.lastRun ? new Date(m.lastRun).toLocaleDateString() : "never";
    console.log(`  ${m.name.padEnd(20)} ${m.runtime.padEnd(6)} ×${String(m.runCount).padStart(3)}  last: ${last}${m.schedule ? " ⏰" : ""}`);
  }
  return 0;
}

function fail(msg: string): number {
  console.error(`orion: ${statusMark("error")} ${msg}`);
  return 1;
}
