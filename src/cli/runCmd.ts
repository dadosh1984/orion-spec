import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { statusMark, paint } from "../utils/term.js";
import {
  listScripts,
  createScript,
  runScript as runScriptCore,
  deleteScript,
  setSchedule,
  readManifest,
  writeManifest,
  scriptPath,
  detectDefaultRuntime,
  resolveBinary,
} from "../core/runtime.js";
import { listCacheEntries } from "../core/specCache.js";
import { canAttemptRepair, markRepairFixed } from "../core/repair.js";
import { addFileWatcher, removeFileWatcher, listWatchers } from "../core/router.js";
import { generateSkill } from "../core/generator.js";

/**
 * `orion run` (v0.39) — автономные локальные скрипты.
 */
export async function runDispatch(args: string[]): Promise<number> {
  const sub = args[0];
  const name = args[1];
  const rest = args.slice(2);

  if (!sub) return runList();

  switch (sub) {
    case "watch": {
      if (!name) return fail("run watch requires: orion run watch <name> <dir> <pattern>");
      const watchDir = rest[0];
      const pattern = rest[1] || "*";
      if (!watchDir) return fail("run watch requires a directory to watch");
      try {
        addFileWatcher(name, watchDir, pattern, name);
        console.log(`${statusMark("done")} Watcher "${name}" added: ${watchDir} (${pattern}) → orion run ${name}`);
      } catch (err) {
        console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      return 0;
    }

    case "unwatch": {
      if (!name) return fail("run unwatch requires a watcher name");
      removeFileWatcher(name);
      console.log(`${statusMark("done")} Watcher "${name}" removed.`);
      return 0;
    }

    case "watchers": {
      const all = listWatchers();
      if (all.length === 0) {
        console.log(`${statusMark("info")} No file watchers registered.`);
      } else {
        console.log(`${statusMark("info")} File watchers (${all.length}):`);
        for (const w of all) {
          console.log(`  ${w.name.padEnd(16)} ${w.watchDir.padEnd(24)} ${w.pattern} → ${w.skillName}`);
        }
      }
      return 0;
    }

    case "generate": {
      if (!name) return fail("run generate requires: orion run generate <name> --from \"<prompt>\"");
      const fromIdx = rest.indexOf("--from");
      const prompt = fromIdx >= 0 ? rest.slice(fromIdx + 1).join(" ") : name;
      try {
        const runtime = rest.includes("--node") ? "node" : rest.includes("--python") ? "python" : "bash";
        const result = generateSkill(name, prompt, runtime);
        console.log(`${statusMark("done")} Skill "${name}" generated:`);
        for (const f of result.files) console.log(`  ✓ ${f}`);
        console.log(`  Risk level: ${result.manifest.risk_level}`);
        console.log(`  Network:    ${result.manifest.sandbox?.network ?? "denied"}`);
        console.log(`\n  Preview:  orion run ${name} --dry-run`);
        console.log(`  Run:      orion run ${name}`);
      } catch (err) {
        console.error(`orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      return 0;
    }

    case "repair": {
      if (!name) return fail("run repair requires a script name");
      const m = readManifest(name);
      if (!m) { console.error(`orion: script "${name}" not found`); return 1; }
      if (!canAttemptRepair(name)) {
        console.log(`${statusMark("error")} Too many repair attempts for "${name}". Manual fix required.`);
        return 1;
      }
      // Repair: mark needs_repair, let LLM fix it (or user edits manually)
      m.status = "needs_repair";
      writeManifest(m);
      console.log(`${statusMark("info")} "${name}" marked as needs_repair.`);
      console.log(`  Edit the script: orion run edit ${name}`);
      console.log(`  Then test:        orion run ${name} --dry-run`);
      console.log(`  Then run:         orion run ${name}`);
      console.log(`  On success, status auto-clears.`);
      return 0;
    }

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
      if (!name) return fail("usage: orion run new <name> [--node|--python]");
      // Runtimes: explicit --node/--python win; else TTY asks; else detect
      // (fall back to node when bash isn't in this process's PATH, v0.47).
      const explicit =
        rest.includes("--node") ? "node" : rest.includes("--python") ? "python" : rest.includes("--bash") ? "bash" : null;
      const runtime =
        explicit ??
        (process.stdin.isTTY
          ? await promptRuntime(detectDefaultRuntime())
          : detectDefaultRuntime());
      const desc = rest
        .join(" ")
        .replace(/--(node|python|bash)\b/g, "")
        .trim() || "No description";
      try {
        const m = createScript(name, runtime as "bash" | "node" | "python", desc);
        console.log(`${statusMark("done")} Script created: ${m.name}`);
        console.log(`  Runtime: ${m.runtime}${explicit ? "" : " (auto)"}`);
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
      // Check --dry-run and --force from anywhere in original argv
      const origArgs = process.argv.slice(2);
      const force = origArgs.includes("--force");
      const dryRun = origArgs.includes("--dry-run");
      const result = runScriptCore(sub, { force, dryRun });
      if (result.ok) {
        // Auto-clear needs_repair on success (v0.42)
        if (m.status === "needs_repair") {
          m.status = "active";
          writeManifest(m);
          markRepairFixed(sub);
        }
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

type Runtime = "bash" | "node" | "python";

/**
 * Interactive runtime picker (v0.47). Shown only when running in a terminal
 * (process.stdin.isTTY). Returns the chosen runtime.
 */
async function promptRuntime(defaultRuntime: Runtime): Promise<Runtime> {
  const choices: Runtime[] = ["node", "python", "bash"];
  // Only offer runtimes that are actually available in this process's PATH.
  const available = choices.filter((r) => r === "node" || resolveBinary(r) !== null);
  const shown = available.length ? available : choices;
  console.log(paint(`  Choose runtime [${shown.join("/")}] (default: ${defaultRuntime}):`, "dim"));
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  return new Promise<Runtime>((resolve) => {
    rl.question("  > ", (ans) => {
      rl.close();
      const a = ans.trim().toLowerCase();
      resolve(
        (shown as string[]).includes(a) ? (a as Runtime) : defaultRuntime,
      );
    });
  });
}
