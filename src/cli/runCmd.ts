import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { statusMark, paint } from "../utils/term.js";
import { confirmAction, lineDiff } from "./helpers.js";
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
import {
  addFileWatcher,
  removeFileWatcher,
  listWatchers,
} from "../core/router.js";
import { verifyRun } from "../core/router.js";
import { generateSkill } from "../core/generator.js";
import {
  getSkillMetric,
  getRecentEvents,
  tokenSummary,
} from "../core/tokenLedger.js";

/**
 * `orion run` (v0.39) — автономные локальные скрипты.
 */
export async function runDispatch(args: string[]): Promise<number> {
  const sub = args[0];
  const name = args[1];
  const rest = args.slice(2);

  if (!sub) return runList();

  if (sub === "--help" || sub === "-h") {
    console.log(
      [
        `${paint("orion run", "cyan")} — autonomous offline scripts (v0.48)`,
        "",
        "  orion run                        List saved scripts",
        "  orion run <name>                 Execute a saved script",
        "  orion run <name> --dry-run       Preview without executing",
        "  orion run <name> --force         Skip hazard gate + policy",
        "  orion run new <name> [--node|--python|--bash]  Create a new script",
        "  orion run show <name>            Show script details + code",
        "  orion run edit <name>            Open script in $EDITOR",
        "  orion run delete <name> [--yes]  Delete a script",
        "  orion run explain <name>         Skill summary + token ROI",
        "  orion run log <name>             Last 20 run events",
        "  orion run stats                  Token economy dashboard",
        "  orion run diff <a> <b>           Line-level diff of two scripts",
        "  orion run schedule <name> <cron> Set cron schedule (linux/mac)",
        "  orion run unschedule <name>      Remove cron schedule",
        "  orion run scheduled              List scheduled scripts",
        '  orion run generate <name> --from "<prompt>"  Generate full skill',
        "  orion run repair <name> [--auto] Mark for repair / auto-reforge",
        "  orion run watch start <name> <dir> [pattern]  Start file watcher",
        "  orion run watch stop <name>      Stop file watcher",
        "  orion run watchers               List file watchers",
        "  orion run cache                  Show spec-driven script cache",
      ].join("\n"),
    );
    return 0;
  }

  switch (sub) {
    case "watch": {
      // run watch start <name> <dir> [pattern] — start real fs.watch (v0.48)
      // run watch stop <name> — stop a running watcher
      // run watch (no sub) — alias for watchers
      if (name === "start") {
        const wName = rest[0];
        const watchDir = rest[1];
        const pattern = rest[2] || "*";
        if (!wName || !watchDir)
          return fail(
            "run watch start requires: orion run watch start <name> <dir> [pattern]",
          );
        if (!existsSync(watchDir))
          return fail(`directory not found: ${watchDir}`);
        try {
          addFileWatcher(wName, watchDir, pattern, wName);
          // Spawn a detached background watcher process (v0.48).
          const child = spawn(
            process.execPath,
            [
              join(
                import.meta.dirname ?? ".",
                "..",
                "..",
                "dist",
                "cli",
                "index.js",
              ),
              "run",
              "watch",
              "--daemon",
              wName,
              watchDir,
              pattern,
            ],
            { detached: true, stdio: "ignore", cwd: process.cwd() },
          );
          child.unref();
          console.log(
            `${statusMark("done")} Watcher "${wName}" started: ${watchDir} (${pattern}) → orion run ${wName}`,
          );
          console.log(`  Stop: orion run watch stop ${wName}`);
        } catch (err) {
          console.error(
            `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
          );
          return 1;
        }
        return 0;
      }
      if (name === "stop") {
        const wName = rest[0];
        if (!wName) return fail("run watch stop requires a watcher name");
        removeFileWatcher(wName);
        console.log(`${statusMark("done")} Watcher "${wName}" stopped.`);
        return 0;
      }
      // --daemon: internal mode — runs fs.watch in foreground (v0.48).
      if (name === "--daemon") {
        const wName = rest[0];
        const watchDir = rest[1];
        const pattern = rest[2] || "*";
        if (!wName || !watchDir)
          return fail("internal: --daemon requires name dir [pattern]");
        const { watch } = await import("node:fs");
        const re = new RegExp(pattern.replace(/\*/g, ".*"));
        process.stderr.write(
          `[watcher] ${wName} watching ${watchDir}/${pattern}\n`,
        );
        watch(watchDir, { recursive: false }, (_e, fn) => {
          if (fn && re.test(fn)) {
            try {
              execSync(
                `"${process.execPath}" "${join(import.meta.dirname ?? ".", "..", "..", "dist", "cli", "index.js")}" run ${wName}`,
                { stdio: "inherit", timeout: 60_000 },
              );
            } catch {
              /* watcher continues */
            }
          }
        });
        // Keep process alive.
        return new Promise(() => {});
      }
      // Fallback: show watchers.
      const all = listWatchers();
      if (all.length === 0) {
        console.log(`${statusMark("info")} No file watchers registered.`);
      } else {
        console.log(`${statusMark("info")} File watchers (${all.length}):`);
        for (const w of all) {
          console.log(
            `  ${w.name.padEnd(16)} ${w.watchDir.padEnd(24)} ${w.pattern} → ${w.skillName}`,
          );
        }
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
          console.log(
            `  ${w.name.padEnd(16)} ${w.watchDir.padEnd(24)} ${w.pattern} → ${w.skillName}`,
          );
        }
      }
      return 0;
    }

    case "generate": {
      if (!name)
        return fail(
          'run generate requires: orion run generate <name> --from "<prompt>"',
        );
      const fromIdx = rest.indexOf("--from");
      const prompt = fromIdx >= 0 ? rest.slice(fromIdx + 1).join(" ") : name;
      const interactive = rest.includes("--interactive");
      try {
        const runtime = rest.includes("--node")
          ? "node"
          : rest.includes("--python")
            ? "python"
            : "bash";
        const result = generateSkill(name, prompt, runtime);

        // Interactive wizard (v0.48): ask for risk, network, schedule, postconditions.
        if (interactive && process.stdin.isTTY) {
          const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
          });
          const ask = (q: string): Promise<string> =>
            new Promise((resolve) => rl.question(q, resolve));

          console.log(`\n${paint("⚙ Interactive skill setup", "cyan")}`);
          console.log(`  Press Enter to accept defaults.\n`);

          // Risk level
          const riskAns = await ask(
            `  Risk level [low/medium/high/critical] (default: ${result.manifest.risk_level}): `,
          );
          const risk = ["low", "medium", "high", "critical"].includes(
            riskAns.trim().toLowerCase(),
          )
            ? (riskAns.trim().toLowerCase() as "low" | "medium" | "high" | "critical")
            : result.manifest.risk_level;
          result.manifest.risk_level = risk;
          result.manifest.requires_confirmation =
            risk === "high" || risk === "critical";

          // Network
          const netAns = await ask(
            `  Network [allowed/denied] (default: ${result.manifest.sandbox?.network ?? "denied"}): `,
          );
          if (netAns.trim() === "allowed") {
            result.manifest.sandbox = {
              ...result.manifest.sandbox,
              network: "allowed",
            };
          }

          // Schedule
          const schedAns = await ask(
            `  Cron schedule (default: none): `,
          );
          if (schedAns.trim()) {
            result.manifest.schedule = schedAns.trim();
          }

          // Postconditions
          const postAns = await ask(
            `  Postcondition [none/json_field/file_exists] (default: none): `,
          );
          if (postAns.trim() === "json_field") {
            const field = await ask(`    JSON field name: `);
            const equals = await ask(`    Expected value: `);
            result.manifest.postconditions = [
              { type: "json_field", field: field.trim(), equals: equals.trim() },
            ];
          } else if (postAns.trim() === "file_exists") {
            const fpath = await ask(`    File path: `);
            result.manifest.postconditions = [
              { type: "file_exists", path: fpath.trim() },
            ];
          }

          rl.close();
          writeManifest(result.manifest);
        } else if (interactive) {
          console.error(
            `${statusMark("warn")} --interactive requires a terminal (TTY). Using defaults.`,
          );
        }

        console.log(`${statusMark("done")} Skill "${name}" generated:`);
        for (const f of result.files) console.log(`  ✓ ${f}`);
        console.log(`  Risk level: ${result.manifest.risk_level}`);
        console.log(
          `  Network:    ${result.manifest.sandbox?.network ?? "denied"}`,
        );
        if (result.manifest.schedule)
          console.log(`  Schedule:   ${result.manifest.schedule}`);
        if (result.manifest.postconditions?.length)
          console.log(
            `  Postcondition: ${result.manifest.postconditions[0].type}`,
          );
        console.log(`\n  Preview:  orion run ${name} --dry-run`);
        console.log(`  Run:      orion run ${name}`);
      } catch (err) {
        console.error(
          `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
      return 0;
    }

    case "repair": {
      if (!name) return fail("run repair requires a script name");
      const m = readManifest(name);
      if (!m) {
        console.error(`orion: script "${name}" not found`);
        return 1;
      }
      const autoMode = rest.includes("--auto");
      if (!canAttemptRepair(name) && !autoMode) {
        console.log(
          `${statusMark("error")} Too many repair attempts for "${name}". Manual fix required.`,
        );
        return 1;
      }
      // Repair: mark needs_repair, let LLM fix it (or user edits manually)
      m.status = "needs_repair";
      writeManifest(m);
      if (autoMode && m.sourceChange) {
        console.log(
          `${statusMark("info")} Auto-repair: re-forging change "${m.sourceChange}"...`,
        );
        try {
          const cli = join(
            import.meta.dirname ?? ".",
            "..",
            "..",
            "dist",
            "cli",
            "index.js",
          );
          execSync(
            `"${process.execPath}" "${cli}" forge ${m.sourceChange} --save-as ${name}`,
            { stdio: "inherit", timeout: 120_000 },
          );
          // On success: clear needs_repair, mark as active.
          m.status = "active";
          writeManifest(m);
          markRepairFixed(name);
          console.log(
            `\n${statusMark("done")} Auto-repair complete: "${name}" is active again.`,
          );
        } catch (err) {
          console.error(
            `\n${statusMark("error")} Auto-repair failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          console.error(
            `  Manual fix: orion run edit ${name}`,
          );
          return 1;
        }
      } else if (autoMode) {
        console.log(
          `${statusMark("warn")} Auto-repair requires sourceChange in manifest.`,
        );
        console.log(
          `  This skill was not created via forge --save-as. Manual repair needed.`,
        );
        console.log(`  Edit: orion run edit ${name}`);
        return 1;
      } else {
        console.log(`${statusMark("info")} "${name}" marked as needs_repair.`);
        console.log(`  Edit the script: orion run edit ${name}`);
        console.log(`  Then test:        orion run ${name} --dry-run`);
        console.log(`  Then run:         orion run ${name}`);
        console.log(`  On success, status auto-clears.`);
      }
      return 0;
    }

    case "diff": {
      if (!name || !rest[0])
        return fail(
          "run diff requires two script names: orion run diff <a> <b>",
        );
      const b = rest[0];
      const ma = readManifest(name);
      const mb = readManifest(b);
      if (!ma) {
        console.error(`orion: script "${name}" not found`);
        return 1;
      }
      if (!mb) {
        console.error(`orion: script "${b}" not found`);
        return 1;
      }
      const codeA = existsSync(scriptPath(name))
        ? readFileSync(scriptPath(name), "utf8")
        : "";
      const codeB = existsSync(scriptPath(b))
        ? readFileSync(scriptPath(b), "utf8")
        : "";
      const diff = lineDiff(codeA, codeB);
      if (diff.length === 0) {
        console.log(
          `${statusMark("done")} Scripts "${name}" and "${b}" are identical.`,
        );
      } else {
        console.log(
          `${statusMark("info")} Diff ${name} → ${b} (${diff.length} lines):`,
        );
        for (const d of diff) {
          const prefix = d.startsWith("+")
            ? paint(d, "green")
            : d.startsWith("-")
              ? paint(d, "red")
              : d;
          console.log(`  ${prefix}`);
        }
      }
      return 0;
    }

    case "explain": {
      if (!name) return fail("run explain requires a script name");
      const m = readManifest(name);
      if (!m) {
        console.error(`orion: script "${name}" not found`);
        return 1;
      }
      const metric = getSkillMetric(name);
      const riskIcon =
        m.risk_level === "critical"
          ? "🔴"
          : m.risk_level === "high"
            ? "🟠"
            : m.risk_level === "medium"
              ? "🟡"
              : "🟢";
      console.log(
        [
          `${statusMark("info")} ${paint(name, "cyan")} — ${m.description}`,
          `  ${paint("Risk:", "dim")}        ${riskIcon} ${m.risk_level ?? "low"}${m.requires_confirmation ? " (requires confirmation)" : ""}`,
          `  ${paint("Runtime:", "dim")}     ${m.runtime}  |  ${paint("Runs:", "dim")} ${m.runCount}  |  ${paint("Last:", "dim")} ${m.lastRun ?? "never"}`,
          `  ${paint("Schedule:", "dim")}    ${m.schedule ?? "none"}`,
          m.sandbox?.network
            ? `  ${paint("Network:", "dim")}    ${m.sandbox.network}`
            : "",
          m.sourceChange
            ? `  ${paint("Source:", "dim")}      change "${m.sourceChange}"`
            : "",
          "",
          metric
            ? (() => {
                const roi = metric.roiScore == null
                  ? "n/a"
                  : metric.roiScore === Infinity
                    ? "∞"
                    : metric.roiScore.toFixed(2);
                return [
                  `  ${paint("Token ROI:", "dim")}   ${roi}x  |  ${paint("Saved:", "dim")} ${metric.totalTokensSaved}  |  ${paint("Net:", "dim")} ${metric.netTokensSaved}`,
                  `  ${paint("Success rate:", "dim")} ${m.runCount > 0 ? Math.round((metric.successRuns / metric.runs) * 100) : 0}% (${metric.successRuns}/${metric.runs})`,
                ].join("\n");
              })()
            : `  ${paint("Token ROI:", "dim")}   no data yet — run the script first`,
          "",
          `  ${paint("Run:", "dim")}        orion run ${name}`,
          `  ${paint("Preview:", "dim")}    orion run ${name} --dry-run`,
          `  ${paint("Log:", "dim")}        orion run log ${name}`,
        ]
          .filter((l) => l !== "")
          .join("\n"),
      );
      return 0;
    }

    case "log": {
      if (!name) return fail("run log requires a script name");
      const events = getRecentEvents(20).filter((e) => e.skillName === name);
      if (events.length === 0) {
        console.log(
          `${statusMark("info")} No events for "${name}". Run the script first.`,
        );
        return 0;
      }
      console.log(
        `${statusMark("info")} Last ${events.length} events for ${paint(name, "cyan")}:`,
      );
      for (const e of events) {
        const statusIcon =
          e.status === "success"
            ? "✅"
            : e.status === "error"
              ? "❌"
              : e.status === "hazard_blocked"
                ? "🚫"
                : "⚠️";
        console.log(
          `  ${statusIcon} ${new Date(e.ts).toLocaleString()}  ${e.mode.padEnd(8)}  ${e.durationMs}ms  ${e.tokensSaved > 0 ? `saved ${e.tokensSaved}` : `in ${e.tokensIn}`}`,
        );
      }
      return 0;
    }

    case "stats": {
      const s = tokenSummary();
      if (s.skillCount === 0) {
        console.log(
          `${statusMark("info")} No skills yet. Create one with: orion run new <name>`,
        );
        return 0;
      }
      console.log(`${statusMark("info")} ${paint("Token economy", "cyan")}:`);
      console.log(
        `  ${paint("Skills:", "dim")}      ${s.skillCount}  |  ${paint("Runs:", "dim")} ${s.totalRuns}  |  ${paint("Events:", "dim")} ${s.totalEvents}`,
      );
      console.log(
        `  ${paint("Saved:", "dim")}       ${s.totalSaved} tokens  (estimated LLM cost avoided)`,
      );
      console.log("");
      const metrics = (await import("../core/tokenLedger.js"))
        .getSkillMetrics()
        .slice(0, 10);
      console.log(`  ${paint("Top skills by tokens saved:", "dim")}`);
      for (const m of metrics) {
        const roi =
          m.roiScore == null
            ? "n/a"
            : m.roiScore === Infinity
              ? "∞"
              : m.roiScore.toFixed(1) + "x";
        console.log(
          `    ${m.skillName.padEnd(20)} ${paint(roi.padStart(6), "green")}  saved ${m.totalTokensSaved}  net ${m.netTokensSaved}  ${m.runs} runs`,
        );
      }
      return 0;
    }

    case "list":
      return runList();

    case "cache": {
      const entries = listCacheEntries();
      if (entries.length === 0) {
        console.log(`${statusMark("info")} Spec cache is empty.`);
      } else {
        console.log(
          `${statusMark("info")} Spec cache (${entries.length} entries):`,
        );
        for (const e of entries) {
          console.log(
            `  ${e.key.padEnd(18)} → ${e.scriptName.padEnd(20)} ×${e.hitCount}  last: ${new Date(e.lastHit).toLocaleDateString()}`,
          );
        }
      }
      return 0;
    }

    case "new": {
      if (!name) return fail("usage: orion run new <name> [--node|--python]");
      // Runtimes: explicit --node/--python win; else TTY asks; else detect
      // (fall back to node when bash isn't in this process's PATH, v0.47).
      const explicit = rest.includes("--node")
        ? "node"
        : rest.includes("--python")
          ? "python"
          : rest.includes("--bash")
            ? "bash"
            : null;
      const runtime =
        explicit ??
        (process.stdin.isTTY
          ? await promptRuntime(detectDefaultRuntime())
          : detectDefaultRuntime());
      // Non-TTY hint (v0.48): tell the user which runtime was auto-selected.
      if (!explicit && !process.stdin.isTTY) {
        console.error(
          `${statusMark("info")} Non-interactive mode: auto-selected runtime "${runtime}". ` +
            `Use --bash, --node or --python to override.`,
        );
      }
      const desc =
        rest
          .join(" ")
          .replace(/--(node|python|bash)\b/g, "")
          .trim() || "No description";
      try {
        const m = createScript(
          name,
          runtime as "bash" | "node" | "python",
          desc,
        );
        console.log(`${statusMark("done")} Script created: ${m.name}`);
        console.log(`  Runtime: ${m.runtime}${explicit ? "" : " (auto)"}`);
        console.log(`  Path:    ${scriptPath(name)}`);
        console.log(`  Edit:    orion run edit ${name}`);
      } catch (err) {
        console.error(
          `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
      return 0;
    }

    case "show": {
      if (!name) return fail("run show requires a script name");
      const m = readManifest(name);
      if (!m) {
        console.error(`orion: script "${name}" not found`);
        return 1;
      }
      const code = existsSync(scriptPath(name))
        ? readFileSync(scriptPath(name), "utf8")
        : "(missing)";
      const riskIcon =
        m.risk_level === "critical"
          ? "🔴"
          : m.risk_level === "high"
            ? "🟠"
            : m.risk_level === "medium"
              ? "🟡"
              : "🟢";
      const lines = [
        `${statusMark("info")} ${paint(name, "cyan")}`,
        `  ${paint("Description:", "dim")} ${m.description}`,
        `  ${paint("Runtime:", "dim")}    ${m.runtime}  |  ${paint("Runs:", "dim")} ${m.runCount}  |  ${paint("Last:", "dim")} ${m.lastRun ?? "never"}`,
        `  ${paint("Risk:", "dim")}       ${riskIcon} ${m.risk_level ?? "low"}`,
        `  ${paint("Schedule:", "dim")}   ${m.schedule ? "⏰ " + m.schedule : "none"}`,
        m.sourceChange
          ? `  ${paint("Source:", "dim")}     change "${m.sourceChange}"`
          : "",
        m.requires_confirmation
          ? `  ${paint("Confirm:", "dim")}    ⚠️  requires confirmation before run`
          : "",
        m.lastForceRun
          ? `  ${paint("Last force:", "dim")} ${new Date(m.lastForceRun).toLocaleString()}`
          : "",
        m.sandbox?.network
          ? `  ${paint("Network:", "dim")}   ${m.sandbox.network}`
          : "",
        m.status && m.status !== "active"
          ? `  ${paint("Status:", "dim")}     ${m.status === "needs_repair" ? "⚠️ needs_repair" : m.status}`
          : "",
        m.lastRunHash
          ? `  ${paint("Cache:", "dim")}      ${m.lastRunHash.slice(0, 12)}…`
          : "",
        "",
        `${paint("───", "dim")}`,
        code.trimEnd(),
      ].filter((l) => l !== "");
      console.log(lines.join("\n"));
      return 0;
    }

    case "edit": {
      if (!name) return fail("run edit requires a script name");
      if (!readManifest(name)) {
        console.error(`orion: script "${name}" not found`);
        return 1;
      }
      const editor = process.env.EDITOR || process.env.VISUAL || "vi";
      try {
        execSync(`${editor} "${scriptPath(name)}"`, { stdio: "inherit" });
      } catch {
        /* ok */
      }
      return 0;
    }

    case "delete": {
      if (!name) return fail("run delete requires a script name");
      const ok = await confirmAction(`Delete script "${name}"?`);
      if (ok === null) {
        // Non-TTY: require explicit --yes to prevent accidental deletion (v0.48).
        if (!rest.includes("--yes")) {
          return fail(
            `delete requires confirmation. Use --yes to delete in non-interactive mode.`,
          );
        }
      } else if (ok === false) {
        console.log(`${statusMark("info")} "${name}" not deleted`);
        return 0;
      }
      try {
        deleteScript(name);
        console.log(`${statusMark("done")} "${name}" deleted`);
      } catch (err) {
        console.error(
          `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
      return 0;
    }

    case "schedule": {
      if (!name || !rest.length)
        return fail("run schedule requires: name cron-expr");
      try {
        setSchedule(name, rest.join(" "));
        console.log(
          `${statusMark("done")} "${name}" scheduled: ${rest.join(" ")}`,
        );
      } catch (err) {
        console.error(
          `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
      return 0;
    }

    case "unschedule": {
      if (!name) return fail("run unschedule requires a script name");
      try {
        setSchedule(name, null);
        console.log(`${statusMark("done")} "${name}" unscheduled`);
      } catch (err) {
        console.error(
          `orion: ${statusMark("error")} ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
      return 0;
    }

    case "scheduled": {
      const sched = listScripts().filter((m) => m.schedule);
      if (sched.length === 0) {
        console.log(`${statusMark("info")} No scheduled scripts.`);
        return 0;
      }
      console.log(`${statusMark("info")} Scheduled (${sched.length}):`);
      for (const m of sched)
        console.log(`  ${m.name.padEnd(20)} ${m.schedule}`);
      return 0;
    }

    default: {
      const m = readManifest(sub);
      if (!m)
        return fail(
          `unknown subcommand or script "${sub}" not found.\n  Usage: orion run [list|new|show|edit|delete|schedule|unschedule|scheduled|cache|<name>]`,
        );
      // Check --dry-run and --force from anywhere in original argv
      const origArgs = process.argv.slice(2);
      const force = origArgs.includes("--force");
      const dryRun = origArgs.includes("--dry-run");
      const result = await runScriptCore(sub, {
        force,
        dryRun,
        args: [name, ...rest].filter(Boolean),
      });
      if (result.ok) {
        // Auto-clear needs_repair on success (v0.42)
        if (m.status === "needs_repair") {
          m.status = "active";
          writeManifest(m);
          markRepairFixed(sub);
        }
        // Post-run verification (v0.48): check postconditions if defined.
        if (m.postconditions && m.postconditions.length > 0) {
          const v = verifyRun(result.output, m.postconditions);
          if (!v.ok) {
            console.error(
              `\n${statusMark("warn")} Postcondition check failed:`,
            );
            for (const c of v.checks.filter((c) => !c.passed)) {
              console.error(`  ${statusMark("error")} ${c.name}: ${c.detail}`);
            }
          }
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
    console.log(
      `${statusMark("info")} No scripts yet.\n  Create: orion run new my-task`,
    );
    return 0;
  }
  console.log(`${statusMark("info")} Scripts (${scripts.length}):`);
  for (const m of scripts) {
    const last = m.lastRun ? new Date(m.lastRun).toLocaleDateString() : "never";
    const risk =
      m.risk_level === "critical"
        ? "🔴"
        : m.risk_level === "high"
          ? "🟠"
          : m.risk_level === "medium"
            ? "🟡"
            : "🟢";
    const src = m.sourceChange ? ` ←${m.sourceChange}` : "";
    const conf = m.requires_confirmation ? " ⚠️" : "";
    const sched = m.schedule ? " ⏰" : "";
    console.log(
      `  ${m.name.padEnd(20)} ${m.runtime.padEnd(6)} ${risk} ×${String(m.runCount).padStart(3)}  last: ${last}${src}${conf}${sched}`,
    );
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
  const available = choices.filter(
    (r) => r === "node" || resolveBinary(r) !== null,
  );
  const shown = available.length ? available : choices;
  console.log(
    paint(
      `  Choose runtime [${shown.join("/")}] (default: ${defaultRuntime}):`,
      "dim",
    ),
  );
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
