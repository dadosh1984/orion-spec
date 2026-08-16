import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeFileSafe } from "../utils/file.js";
import { DEFAULT_PORT } from "../constants.js";
import { statusMark, paint } from "../utils/term.js";
import { readVersionSafe } from "../utils/version.js";
import {
  updateCheckEnabled,
  checkForUpdate,
  updateBanner,
} from "../core/updateCheck.js";
import { parseArgs, HELP, DEPRECATED_ALIASES } from "./parse.js";
// Re-exported for tests and peer modules that import the CLI entry point.
export { parseArgs } from "./parse.js";
export type { CliOptions } from "./helpers.js";
import { printOut, fail, lineDiff, confirmAction } from "./helpers.js";
import { tddCommand } from "./tddCmd.js";
import { pluginCommand } from "./pluginCmd.js";
import { OrionTrack } from "../core/track.js";
import {
  learnFromSessions,
  sessionFiles,
  sessionRoleBreakdown,
} from "../core/sessions.js";
import { exportLessons, importLessons } from "../core/lessons.js";
import { profilePath } from "../core/profile.js";
import { profileView } from "../tasks/profile_cli_view.js";
import { applyScale, previewScale } from "../core/scale.js";
import { think, askQuestion } from "../skills/think/handler.js";
import { draft } from "../skills/draft/handler.js";
import { forge, forgeParallel, readTasks } from "../skills/forge/handler.js";
import { shield } from "../skills/shield/handler.js";
import { out } from "../skills/out/handler.js";
import { nextStep } from "../skills/next/handler.js";
import { reviewChange } from "../skills/review/handler.js";
import { archiveChange } from "../skills/archive/handler.js";
import { scanChanges, listTable, projectStats } from "./overviewCmd.js";
import { compareCmd, assumptionsCmd } from "./compareCmd.js";
import { selfAudit } from "./selfauditCmd.js";
import { backupCmd, restoreCmd } from "./backupCmd.js";
import { doctor } from "./doctorCmd.js";
import {
  exportProfile,
  importProfile,
  resetProfile,
  updateProfile,
} from "../core/profile.js";
import { changelogFor, changelogAll } from "./changelogCmd.js";
import { resume } from "../skills/resume/handler.js";
import { verifyChange, formatVerifyReport } from "../core/verify.js";
import { guardPrompt, checkNpmPackages } from "../skills/think/guard.js";
import { startServer, readVersion } from "./serve.js";
import { configCmd } from "./configCmd.js";
import { cleanCmd } from "./cleanCmd.js";
import { statusWatch } from "./statusWatchCmd.js";
import { diffCmd } from "./diffCmd.js";
import { envCmd } from "./envCmd.js";
import {
  clarifyCommand,
  answerCommand,
  refineCommand,
} from "./clarifyCmd.js";
import { runDispatch } from "./runCmd.js";
import { createScript, scriptPath, writeManifest } from "../core/runtime.js";
import {
  metricsReport,
  formatMetricsReport,
  formatSessionReport,
} from "../core/metrics.js";
import { McpServer, toolManifest } from "../core/mcp.js";
import { findPluginForCommand, loadPluginHandler } from "../core/plugins.js";

/**
 * Build the `orion --help` command section from the LIVE registry (v0.52,
 * B1). Single source of truth: help lists exactly what main() will dispatch,
 * so it can never drift into listing deprecated commands. Call AFTER
 * registerAllCommands(), inside main().
 */
function buildHelp(
  registry?: Map<
    string,
    { name: string; description: string; aliases?: string[] }
  >,
): string {
  const head = `orion — self-contained AI-agent toolkit

Usage:
  orion <command> [args...] [flags...]

Commands:`;
  const lines: string[] = [];
  if (registry && registry.size > 0) {
    for (const spec of registry.values()) {
      const aliasNote = spec.aliases?.length
        ? `  (aliases: ${spec.aliases.join(", ")})`
        : "";
      lines.push(`  ${spec.name.padEnd(10)} ${spec.description}${aliasNote}`);
    }
  } else {
    lines.push(`  (no commands registered)`);
  }
  const flags = `\n\nFlags:\n  --no-cache   Skip all cache reads/writes\n  --no-color   Disable colored/emoji output (NO_COLOR is honoured too, v0.31)\n  --dry        Preview instead of executing\n  --json       Machine-readable output\n  --port N     Listen port for serve (default 4780)\n  --host H     Bind host for serve (default 127.0.0.1)\n  --token T    Bearer token for serve (auto-generated when host is not loopback)\n  --ui         Serve the HTML dashboard at / (default for serve)\n  --lang en|ru Template language override for draft (v0.27)`;
  return head + "\n" + lines.join("\n") + flags;
}

/** Command dispatcher. */
export async function main(argv: string[]): Promise<number> {
  const { cmd, args, opts } = parseArgs(argv);
  const track = OrionTrack.init();

  // v0.51: deprecated alias notice. When the user runs an old command
  // name, print a one-line warning to stderr before the legacy case
  // branch runs. Aliases will be removed entirely in v0.52.
  if (cmd && Object.prototype.hasOwnProperty.call(DEPRECATED_ALIASES, cmd)) {
    const target = DEPRECATED_ALIASES[cmd];
    if (target === "__removed__") {
      console.error(
        `orion: '${cmd}' was removed in v0.51; use 'orion new' or 'orion doctor' instead`,
      );
      return 1;
    }
    if (target === "__hidden__") {
      console.error(`orion: '${cmd}' is not a public command`);
      return 1;
    }
    console.error(
      `orion: '${cmd}' is deprecated, use '${target}' (will be removed in v0.52)`,
    );
  }

  // v0.51: route canonical (non-deprecated) top-level commands through
  // the new ORION_REGISTRY. Unknown commands still fall through to the
  // legacy switch for plugin discovery and back-compat shims.
  // Also rewrite `cmd` to the canonical name so the legacy switch below
  // sees the same value the registry would have dispatched.
  let canonical = cmd;
  let helpText = HELP; // static fallback; replaced by dynamic registry help
  try {
    const { registerAllCommands, ORION_REGISTRY } =
      await import("./bootstrap.js");
    registerAllCommands();
    if (cmd && Object.prototype.hasOwnProperty.call(DEPRECATED_ALIASES, cmd)) {
      const target = DEPRECATED_ALIASES[cmd];
      if (target && !target.startsWith("__")) {
        canonical = target;
        // `orion init` is a bare alias to doctor; inject --init so it runs
        // the scaffold, not the health check (v0.52, 2.1).
        if (target === "doctor" && cmd === "init" && !args.includes("--init")) {
          args.unshift("--init");
        }
      }
    }
    const spec = ORION_REGISTRY.get(canonical);
    if (spec) {
      return await spec.handler(args, opts);
    }
    // B1: dynamic help from the live registry (needs registration first).
    helpText = buildHelp(ORION_REGISTRY as never);
  } catch {
    /* bootstrap failure must not break the legacy switch */
  }

  switch (canonical) {
    case "version": {
      console.log(`orion ${readVersionSafe()}`);
      return 0;
    }
    case "":
    case "help":
    case "--help":
    case "-h":
      console.log(helpText);
      return 0;

    case "guard-prompt": {
      const prompt = args.join(" ").trim();
      if (!prompt) return fail("guard-prompt requires a prompt");
      const guard = guardPrompt(prompt);
      const lines = [`Guard verdict: ${guard.ok ? "clean" : "suspicious"}`];
      if (guard.packages.length > 0) {
        if (opts.npm) {
          const verdict = await checkNpmPackages(
            guard.packages.map((p) => p.name),
          );
          for (const p of guard.packages) {
            const v = verdict[p.name] ?? "unknown";
            lines.push(
              `  ${v === "missing" ? "❌" : v === "exists" ? "✓" : "?"} ${p.name} — ${v} (${p.context})`,
            );
          }
        } else {
          lines.push(
            "  package-like references: " +
              guard.packages.map((p) => p.name).join(", "),
          );
          lines.push(
            "  (run with --npm to probe the npm registry — fail-open, offline-safe)",
          );
        }
      }
      for (const i of guard.issues) lines.push(`  ⚠ ${i}`);
      if (!guard.ok) {
        lines.push(
          "Proposal creation is blocked until you confirm with `orion think --force`.",
        );
      }
      console.log(lines.join("\n"));
      return guard.ok ? 0 : 2;
    }

    case "think": {
      const prompt = args.join(" ");
      if (!prompt)
        return fail(
          'think requires a prompt, e.g. orion think "Build a CSV-to-JSON tool"',
        );
      const proposal = await think(prompt, opts);
      // Skill-first hint (v0.48→v0.51): unified BM25 matching path.
      try {
        const { matchSkill, resolveDomain } =
          await import("../core/skillsMatch.js");
        const ex = matchSkill(prompt, { domain: resolveDomain() });
        if (ex.kind === "matched") {
          console.error(
            `\n${statusMark("info")} Existing skill found: "${ex.skill.name}" (tier=${ex.tier}, score: ${ex.score.toFixed(2)}).`,
          );
          console.error(`  Run with: orion run ${ex.skill.name}`);
          console.error(
            `  Or continue creating a new change: orion draft ${proposal.title}\n`,
          );
        }
      } catch {
        /* router not critical for think */
      }
      printOut(
        opts,
        proposal,
        `Proposal "${proposal.title}" saved. Next: orion draft ${proposal.title}`,
      );
      return 0;
    }

    case "draft": {
      const title = args[0];
      if (!title)
        return fail("draft requires a title, e.g. orion draft my-csv-tool");
      // Skill-first hint (v0.49→v0.51): unified BM25 matching path.
      try {
        const { matchSkill, resolveDomain } =
          await import("../core/skillsMatch.js");
        const ex = matchSkill(title, { domain: resolveDomain() });
        if (ex.kind === "matched") {
          console.error(
            `\n${statusMark("warn")} Existing skill "${ex.skill.name}" matches (tier=${ex.tier}, score: ${ex.score.toFixed(2)}).`,
          );
          console.error(
            `  Consider: orion run ${ex.skill.name}  (instead of drafting a new change)\n`,
          );
        }
      } catch {
        /* router not critical */
      }
      const artifacts = await draft(title, {
        noCache: opts.noCache,
        lang: opts.lang,
      });
      printOut(
        opts,
        artifacts,
        `Draft artifacts created for "${title}" under changes/${title}/`,
      );
      return 0;
    }

    case "forge": {
      const title = args[0];
      if (!title)
        return fail("forge requires a draft id, e.g. orion forge my-csv-tool");
      // Live checklist: each task is ticked off in the terminal as it runs.
      const onTask = (row: {
        desc: string;
        status: "done" | "skipped" | "pending";
      }) => {
        const mark =
          row.status === "done"
            ? "✓"
            : row.status === "skipped"
              ? "✓ (cached)"
              : "· (no snippet)";
        console.log(`  ${mark} ${row.desc}`);
      };
      const summary =
        opts.parallel !== undefined && opts.parallel >= 2
          ? await forgeParallel(title, {
              noCache: opts.noCache,
              parallel: opts.parallel,
              onTask,
            })
          : await forge(title, {
              noCache: opts.noCache,
              onTask,
            });
      printOut(opts, summary, summary.message);
      // --save-as: сохранить результат как runnable script (v0.39.1)
      if (opts.saveAs && summary.ok) {
        const saveName = opts.saveAs;
        try {
          // Конвенция: точка входа — changes/<title>/entry.js или entry.ts.
          // Если её нет — forge правил существующие файлы, автономного скрипта
          // не получилось. Честный отказ лучше молчаливой пустышки.
          const entryCandidates = [
            `changes/${title}/entry.js`,
            `changes/${title}/entry.ts`,
          ];
          let entryPath: string | null = null;
          for (const ec of entryCandidates) {
            if (existsSync(ec)) {
              entryPath = ec;
              break;
            }
          }

          if (!entryPath) {
            // Второй шанс: git diff src/tasks/ — forge мог создать новые файлы
            const { execSync } = await import("node:child_process");
            try {
              const changed = execSync(
                "git diff --name-only HEAD -- src/tasks/",
                { encoding: "utf8" },
              )
                .trim()
                .split("\n")
                .filter((f) => f.endsWith(".ts") && existsSync(f));
              if (changed.length === 1) {
                // Ровно один новый файл — используем как точку входа
                entryPath = changed[0];
              }
            } catch {
              // not a git repo — ok
            }
          }

          if (!entryPath) {
            // Честный отказ: нечего сохранять как автономный скрипт
            console.error(
              `\n${statusMark("error")} --save-as failed: change "${title}" не содержит автономной точки входа.`,
            );
            console.error(
              `  Создайте changes/${title}/entry.js с финальным кодом и повторите forge --save-as.`,
            );
            return 1;
          }

          // Создаём скрипт и копируем реальный код. v0.51: fill domain +
          // environmentFingerprint at save time (was "general"/none before).
          const { meta: skillMetaForSave } = await (async () => {
            const { resolveDomain, environmentFingerprint } =
              await import("../core/skillsMatch.js");
            return {
              meta: {
                domain: resolveDomain(),
                environmentFingerprint: environmentFingerprint({
                  runtime: process.version,
                }),
              },
            };
          })();
          const m = createScript(
            saveName,
            "node",
            `Forge result for change: ${title}`,
            skillMetaForSave,
          );
          const entryCode = readFileSync(entryPath, "utf8");
          writeFileSync(scriptPath(saveName), entryCode, "utf8");
          // Записываем sourceChange для трассируемости
          m.sourceChange = title;
          writeManifest(m);
          console.log(
            `\n${statusMark("done")} Saved as runnable script: ${saveName}`,
          );
          console.log(`  Source: changes/${title}/${entryPath}`);
          console.log(`  Run anytime with: orion run ${saveName}`);
        } catch (err) {
          console.error(
            `\n${statusMark("error")} --save-as failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          return 1;
        }
      }
      return summary.ok ? 0 : 1;
    }

    case "tasks": {
      const title = args[0];
      if (!title)
        return fail("tasks requires a change id, e.g. orion tasks my-csv-tool");
      const tasks = readTasks(title);
      if (tasks.length === 0)
        return fail(
          `no tasks under changes/${title}/ — run "orion draft ${title}" first`,
        );
      const done = tasks.filter((t) => t.done).length;
      printOut(
        opts,
        { title, done, total: tasks.length, tasks },
        [
          `Tasks — ${title}  (${done}/${tasks.length})`,
          "",
          ...tasks.map((t) => `${t.done ? "✓" : "·"} ${t.text}`),
          "",
          done === tasks.length
            ? "All tasks complete."
            : `${tasks.length - done} task(s) left.`,
        ].join("\n"),
      );
      return 0;
    }

    case "shield": {
      const changeId = args[0];
      if (!changeId)
        return fail(
          "shield requires a change id, e.g. orion shield my-csv-tool",
        );
      const report = await shield(changeId, opts);
      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        for (const c of report.checks) {
          const color =
            c.status === "PASS"
              ? "green"
              : c.status === "FAIL"
                ? "red"
                : c.status === "WARN"
                  ? "yellow"
                  : "dim";
          console.log(
            `  ${paint(c.status.padEnd(4), color)} ${c.step.padEnd(14)} ${c.detail ?? ""}`,
          );
        }
        console.log(
          `\n  ${report.allPass ? statusMark("done") : statusMark("error")} ${paint(report.allPass ? "PASS" : "FAIL", report.allPass ? "green" : "red")}`,
        );
      }
      return report.allPass ? 0 : 1;
    }

    case "refine":
      return await refineCommand(args, opts.auto);

    case "answer":
      return await answerCommand(args, opts);

    case "clarify":
      return await clarifyCommand(args);

    case "out": {
      const changeId = args[0];
      if (!changeId) return fail("out requires a change id");
      const result = await out(changeId, opts);
      printOut(opts, result, `Result written to changes/${changeId}/result.md`);
      return result.allPass ? 0 : 1;
    }

    case "update": {
      const { updateAgentFiles } = await import("../core/updateAgent.js");
      const r = updateAgentFiles();
      console.log(`\n${statusMark("info")} AI-agent command files:`);
      console.log(
        `  .claude/commands : ${r.claude === true ? "✓ present" : "— absent"}`,
      );
      console.log(
        `  .cursor/rules   : ${r.cursor === true ? "✓ present" : "— absent"}`,
      );
      for (const f of r.files) {
        const state = r.refreshed.includes(join(process.cwd(), f))
          ? "refreshed"
          : "up-to-date";
        console.log(`  ${statusMark("done")} ${f} (${state})`);
      }
      if (r.refreshed.length === 0)
        console.log(
          `  ${statusMark("info")} nothing changed — all files idempotent.`,
        );
      return 0;
    }

    case "badge": {
      const changeId = args[0];
      if (!changeId) return fail("badge requires a change id");
      const { writeBadge } = await import("../skills/out/badge.js");
      const res = writeBadge(changeId);
      if (!res) return fail(`badge: no changes/${changeId}/receipt.json`);
      console.log(
        `\n${statusMark(res.status === "verified" ? "done" : res.status === "failing" ? "error" : "warn")} ${paint(res.status, res.status === "verified" ? "green" : res.status === "failing" ? "red" : "yellow")} — ${res.svgPath} (${res.svgBytes} B)`,
      );
      console.log(res.markdown);
      return 0;
    }

    case "export-trust": {
      const changeId = args[0];
      if (!changeId) return fail("export-trust requires a change id");
      const { exportTrust } = await import("../skills/out/trust.js");
      const t = exportTrust(changeId);
      if (!t) return fail(`export-trust: no changes/${changeId}/proposal.json`);
      console.log(
        `\n${statusMark("done")} trust exported → changes/${changeId}/trust.json`,
      );
      console.log(`  integrity: ${t.integrity}`);
      console.log(
        `  artifacts: proposal · tasks · spec · tests (${t.testCount} test file(s))`,
      );
      return 0;
    }

    case "verify-trust": {
      const changeId = args[0];
      if (!changeId) return fail("verify-trust requires a change id");
      const { verifyTrust } = await import("../skills/out/trust.js");
      const r = verifyTrust(changeId);
      console.log(
        `\n${r.ok ? statusMark("done") : statusMark("error")} ${paint(r.ok ? "trust verified" : "trust FAILED", r.ok ? "green" : "red")} — ${r.detail}`,
      );
      return r.ok ? 0 : 1;
    }

    case "lineage": {
      const lessonId = args[0];
      if (!lessonId) return fail("lineage requires a lesson id");
      const { lineageOf, lessonSourceChange } =
        await import("../core/lineage.js");
      if (opts.json) {
        console.log(JSON.stringify(lineageOf(lessonId), null, 2));
        return 0;
      }
      const src = lessonSourceChange(lessonId);
      const nodes = lineageOf(lessonId);
      console.log(`\n${statusMark("info")} Lineage for lesson "${lessonId}":`);
      console.log(
        `  ← born from: ${src ? `change "${src}"` : "(not recorded — manual lesson)"}`,
      );
      // Forward chain: nodes after the seed lesson (and its source-change, if any).
      const forward = src ? nodes.slice(2) : nodes.slice(1);
      if (forward.length === 0) console.log("  → applied to: (none yet)");
      else {
        console.log("  → lineage chain (explicit links):");
        for (const n of forward) {
          console.log(`      ${paint(n.kind, "dim")} "${n.id}"`);
        }
      }
      return 0;
    }

    case "verify": {
      const changeId = args[0];
      if (!changeId) return fail("verify requires a change id");
      const result = verifyChange(changeId, process.cwd(), { cache: true });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.cached) {
          console.log("(cached — spec and source tree unchanged)");
        }
        console.log(formatVerifyReport(result));
      }
      // A signal, never a gate: exit 0 even when something is missing.
      return 0;
    }

    case "pay-debt": {
      // Thin manual trigger (v0.52): `out` auto-pays debt; this keeps the
      // standalone name working by forwarding to the per-change handler (which
      // throws on a missing change). Removed from the registry as a separate
      // skill; only auto-invoked by `out` or requested via `change --pay-debt`.
      const changeId = args[0];
      if (!changeId)
        return fail(
          "pay-debt requires a change id, e.g. orion pay-debt my-csv-tool",
        );
      const { payDebt } = await import("../skills/pay-debt/handler.js");
      const result = payDebt(changeId);
      printOut(
        opts,
        result,
        result.paid.length > 0
          ? `Debt paid: ${result.paid.length} snippet(s) closed`
          : result.stillOwed.length > 0
            ? `${result.stillOwed.length} snippet(s) still owe — run orion scale <file> to pay them`
            : "No open debt",
      );
      return 0;
    }

    case "resume": {
      const changeId = args[0];
      if (!changeId)
        return fail(
          "resume requires a change id, e.g. orion resume my-csv-tool",
        );
      const result = await resume(changeId);
      printOut(
        opts,
        result,
        `resumed ${changeId} at phase "${result.phase}" (from ${result.resumedFrom}${result.step ? `, step: ${result.step}` : ""})`,
      );
      return 0;
    }

    case "next": {
      const result = await nextStep();
      // Companion logic (v0.10): when the state is ambiguous, propose the
      // alternatives and let the user (the guide) choose — never decide
      // silently on their behalf in an interactive terminal. Agents keep
      // the full options in the returned JSON and auto-execute.
      if (
        process.stdin.isTTY &&
        result.confidence === "low" &&
        result.alternatives.length > 0
      ) {
        console.log(result.summary);
        console.log("");
        const answer = await askQuestion(
          `Choose one (1-${result.alternatives.length}, or Enter to do nothing): `,
        );
        const picked = Number(answer);
        if (
          Number.isInteger(picked) &&
          picked >= 1 &&
          picked <= result.alternatives.length
        ) {
          console.log(result.alternatives[picked - 1]);
        }
        return 0;
      }
      printOut(opts, result, result.summary);
      return 0;
    }

    case "profile": {
      // User adaptation (v0.26): show the memory.md analogue. Renders the
      // file as-is (it is already human-readable markdown) or an honest
      // hint when it does not exist yet. Sub-commands (v0.27/v0.37):
      //   orion profile --reset       clear auto-observed signals (keep notes)
      //   orion profile export        print portable JSON to stdout
      //   orion profile import <f>    load a portable JSON profile
      //   orion profile set <k> <v>   set a profile field manually
      const sub = args[0];
      if (sub === "--reset") {
        resetProfile();
        console.log("orion: profile auto-section reset (user notes kept)");
        return 0;
      }
      if (sub === "export") {
        console.log(JSON.stringify(exportProfile(), null, 2));
        return 0;
      }
      if (sub === "import") {
        const file = args[1];
        if (!file) return fail("profile import requires a JSON file");
        try {
          const raw = readFileSync(file, "utf8");
          const path = importProfile(raw);
          console.log(`orion: profile imported from ${file} → ${path}`);
          return 0;
        } catch (err) {
          return fail(
            `profile import failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (sub === "set") {
        const key = args[1];
        const value = args.slice(2).join(" ");
        if (!key || !value) {
          return fail(
            "profile set requires: profile set language|platform|budget <value>",
          );
        }
        const signals: Record<string, string> = {};
        if (key === "language") {
          if (value !== "en" && value !== "ru") {
            return fail('language must be "en" or "ru"');
          }
          signals.language = value;
        } else if (key === "platform") {
          signals.platform = value;
        } else if (key === "budget") {
          signals.budget = value;
        } else {
          return fail(
            `unknown profile field: ${key} (expected: language, platform, budget)`,
          );
        }
        updateProfile(signals);
        console.log(`orion: profile ${key} = ${value}`);
        return 0;
      }
      printOut(opts, { path: profilePath() }, profileView());
      return 0;
    }

    case "compare": {
      const a = args[0];
      const b = args[1];
      if (!a || !b) return fail("compare requires two change ids");
      const result = compareCmd(a, b);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "assumptions": {
      const id = args[0];
      if (!id) return fail("assumptions requires a change id");
      const result = assumptionsCmd(id);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "self-audit": {
      const result = selfAudit();
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "backup": {
      const target = args[0];
      if (!target)
        return fail(
          "backup requires an output file, e.g. orion backup ./orion-backup.json",
        );
      const result = backupCmd(target);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "restore": {
      const target = args[0];
      if (!target) return fail("restore requires a backup file");
      const result = restoreCmd(target);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "status": {
      if (opts.watch) {
        statusWatch();
        return 0;
      }
      printOut(opts, { changes: scanChanges() }, listTable(scanChanges()));
      return 0;
    }

    case "list": {
      if (opts.watch) {
        statusWatch();
        return 0;
      }
      printOut(opts, { changes: scanChanges() }, listTable(scanChanges()));
      return 0;
    }

    case "stats": {
      printOut(
        opts,
        { stats: projectStats() },
        (() => {
          const s = projectStats();
          return [
            `Changes: ${s.changes} (${s.done} done, ${s.open} open)`,
            `Tasks: ${s.tasksDone}/${s.tasks} done`,
            `Lessons: ${s.lessons}`,
            `Cache: ${s.cacheEntries} entries, ${Math.round(Number(s.cacheBytes) / 1024)} KB`,
          ].join("\n");
        })(),
      );
      return 0;
    }

    case "review": {
      const title = args[0];
      if (!title)
        return fail("review requires a title, e.g. orion review my-csv-tool");
      const report = reviewChange(title);
      const head = report.pass
        ? paint("PASS", "green")
        : paint("issues found", "red");
      printOut(
        opts,
        { changeId: title, pass: report.pass, checks: report.checks },
        [
          `Review ${statusMark(report.pass ? "done" : "error")} ${head} — ${title}`,
          ...report.checks.map(
            (c) =>
              `  ${statusMark(c.ok ? "done" : "error")} ${c.name}: ${c.detail}`,
          ),
        ].join("\n"),
      );
      return report.pass ? 0 : 1;
    }

    case "archive": {
      const title = args[0];
      if (!title)
        return fail("archive requires a title, e.g. orion archive my-csv-tool");
      const ok = await confirmAction(`Archive "${title}"?`);
      if (ok === false) {
        console.log(`${paint("cancelled", "dim")} — no changes made`);
        return 0;
      }
      try {
        const moved = archiveChange(title);
        console.log(
          `orion: archived ${moved.from} → ${moved.to} (debt ledger self-heals on orphaned snippets)`,
        );
        return 0;
      } catch (err) {
        return fail(err instanceof Error ? err.message : String(err));
      }
    }

    case "doctor": {
      const report = doctor();
      console.log(
        [
          `Doctor ${statusMark(report.pass ? "done" : "error")} ${paint(report.pass ? "all healthy" : "issues found", report.pass ? "green" : "red")}`,
          ...report.checks.map(
            (c) =>
              `  ${statusMark(c.ok ? "done" : "error")} ${c.name}: ${c.detail}`,
          ),
        ].join("\n"),
      );
      return report.pass ? 0 : 1;
    }

    case "changelog": {
      const title = args[0];
      if (title) {
        console.log(`## ${title}\n\n${changelogFor(title)}`);
      } else {
        const all = changelogAll();
        printOut(
          opts,
          { entries: all.length },
          all.length
            ? all.join("\n\n---\n\n")
            : "No changes with result.md yet — run orion out <title> first.",
        );
      }
      return 0;
    }

    case "learn": {
      const target = args[0];
      if (!target)
        return fail("learn requires a session file or directory of sessions");
      const files = sessionFiles(target);
      if (files.length === 0)
        return fail(`no *.jsonl session files found at ${target}`);
      const report = learnFromSessions(files);
      printOut(
        opts,
        report,
        `learned from ${report.files} file(s), ${report.records} record(s), ${report.actions} action(s): ${report.pairs} failure→success pattern(s), ${report.lessons} lesson(s) recorded${report.skipped > 0 ? `, ${report.skipped} invalid line(s) skipped` : ""}`,
      );
      return 0;
    }

    case "lessons": {
      // Federated learning (v0.23): share the ledger between projects and
      // developers via a file or any URL — zero dependencies (built-in fetch).
      const sub = args[0];
      const target = args[1];
      if (sub === "export") {
        if (!target) return fail("lessons export requires a destination path");
        const r = exportLessons(target);
        printOut(opts, r, `exported ${r.exported} lesson(s) to ${target}`);
        return 0;
      }
      if (sub === "import") {
        if (!target) return fail("lessons import requires a file path or URL");
        try {
          const r = await importLessons(target);
          printOut(
            opts,
            r,
            `imported ${r.added} lesson(s) from ${target} (${r.skipped} skipped: duplicate/invalid, ${r.total} rows read)`,
          );
        } catch (err) {
          return fail(
            `lessons import failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return 0;
      }
      return fail(
        "lessons expects a sub-command: export <path> | import <path|url>",
      );
    }

    case "scale": {
      const file = args[0];
      if (!file)
        return fail("scale requires a file, e.g. orion scale src/foo.ts");
      const code = await readFile(file, "utf8");
      if (opts.dry) {
        const preview = await previewScale(code, file);
        const changed = preview.stages.filter((s) => s.changed);
        printOut(
          opts,
          {
            dry: true,
            file,
            stages: preview.stages.map((s) => ({
              name: s.name,
              changed: s.changed,
            })),
            diff: changed.length ? lineDiff(code, preview.final) : "no changes",
          },
          [
            `[dry] ${file}: ${changed.length}/${preview.stages.length} stages would change the code`,
            ...changed.map((s) => `  • ${s.name} → changed`),
            "",
            ...lineDiff(code, preview.final),
          ].join("\n"),
        );
      } else {
        const result = await applyScale(code, { noCache: opts.noCache, file });
        await writeFileSafe(file.replace(/\.ts$/, ".scaled.ts"), result);
        printOut(
          opts,
          { scaled: result },
          `Scaled ${file} -> ${file.replace(/\.ts$/, ".scaled.ts")}`,
        );
      }
      return 0;
    }

    case "tdd":
      return await tddCommand(args, opts);

    case "metrics": {
      // `metrics --session <file.jsonl>` (v0.15): per-role token breakdown
      // of one session instead of the benchmark report. Honest by default:
      // a missing/unreadable/non-jsonl path is an error, never an empty table.
      if (opts.session) {
        const path = opts.session;
        if (!path.toLowerCase().endsWith(".jsonl")) {
          return fail(`--session expects a .jsonl file, got: ${path}`);
        }
        let text: string;
        try {
          text = await readFile(path, "utf8");
        } catch {
          return fail(`--session: cannot read ${path}`);
        }
        const b = sessionRoleBreakdown(text);
        printOut(opts, b, formatSessionReport(path, b));
        return 0;
      }
      const report = await metricsReport(track, readVersion());
      printOut(opts, report, formatMetricsReport(report));
      return 0;
    }

    case "memory": {
      // B2: one grouped view over profile/cache/lessons/env/metrics state.
      const { memoryHandler } = await import("./memoryCmd.js");
      return await memoryHandler(track, args);
    }

    case "config": {
      const result = configCmd(args);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "run":
      // Pass --dry-run flag to runDispatch
      if (opts.dry && !args.includes("--dry-run")) {
        args.push("--dry-run");
      }
      return runDispatch(args);

    case "env": {
      const envResult = envCmd();
      console.log(envResult.text);
      return envResult.ok ? 0 : 1;
    }

    case "diff": {
      const diffId = args[0];
      if (!diffId) return fail("diff requires a change id");
      const diffResult = diffCmd(diffId);
      console.log(diffResult.text);
      return diffResult.ok ? 0 : 1;
    }

    case "clean": {
      const what = args[0] ?? "cache";
      const ok = await confirmAction(
        `Run clean on "${what}"? (removes cache/reports/dist/coverage)`,
      );
      if (ok === false) {
        console.log(`${paint("cancelled", "dim")} — nothing removed`);
        return 0;
      }
      const result = cleanCmd(args);
      console.log(result.text);
      return result.ok ? 0 : 1;
    }

    case "serve": {
      const token = opts.token ?? process.env.ORION_DASHBOARD_TOKEN;
      const server = await startServer(track, {
        port: opts.port || DEFAULT_PORT,
        ui: opts.ui,
        host: opts.host ?? "127.0.0.1",
        token,
      });
      const addr = server.address();
      const port =
        typeof addr === "object" && addr
          ? addr.port
          : opts.port || DEFAULT_PORT;
      const host = opts.host ?? "127.0.0.1";
      console.log(
        `orion: dashboard at http://${host}:${port} (Ctrl+C to stop)`,
      );
      if (server.authToken) {
        console.log(`orion: auth token: ${server.authToken}`);
        console.log(
          `orion: open http://${host}:${port}/?token=${server.authToken} — every API call requires the token`,
        );
      }
      await new Promise<void>((resolve) => {
        const stop = () => server.close(() => resolve());
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
      });
      return 0;
    }

    case "mcp": {
      if (args.includes("--list")) {
        console.log(JSON.stringify(toolManifest(), null, 2));
        return 0;
      }
      if (args.includes("--help")) {
        console.log(
          "orion mcp — Model Context Protocol server for AI agents\n\n" +
            "  Runs JSON-RPC 2.0 over stdio. Attach from any MCP client:\n" +
            "    claude mcp add orion -- orion mcp\n" +
            "    codex mcp add orion -- orion mcp\n" +
            "    opencode: add to opencode.json mcp section\n\n" +
            "  orion mcp --list   print the tool manifest (JSON)\n" +
            "  orion mcp --help   this help",
        );
        return 0;
      }
      const server = new McpServer();
      // Update banner (v0.36): non-blocking; the registry check has a 2.5s
      // timeout and fails silently offline. stderr so stdio stays protocol-
      // clean. Agents see the version + a heads-up when a release exists.
      if (updateCheckEnabled()) {
        const info = await checkForUpdate();
        process.stderr.write(`\n${updateBanner(info)}\n`);
      }
      await server.runStdio();
      return 0;
    }

    case "plugin":
      return await pluginCommand(args, opts);

    default: {
      // v0.3: unknown commands are dispatched to installed plugins.
      const plugin = findPluginForCommand(cmd);
      if (plugin) {
        try {
          const handler = await loadPluginHandler(plugin);
          return await handler(args, {
            track,
            cwd: process.cwd(),
            options: opts,
            log: (message) => console.log(message),
          });
        } catch (err) {
          console.error(
            `orion: plugin "${plugin.name}" failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return 1;
        }
      }
      // v0.7: natural-language fallback — `orion <multi-word prompt>`
      // captures the idea as a proposal (shorthand for `orion think`).
      // Single-word input stays an error so command typos are visible.
      // A whole quoted phrase (`orion "build a calculator"`) arrives as
      // one argv entry with spaces — that is a prompt too (v0.8.1).
      const prompt = args.length > 0 ? [cmd, ...args].join(" ") : cmd;
      if (args.length === 0 && !cmd.includes(" ")) {
        console.log(`orion: unknown command "${cmd}"\n\n${helpText}`);
        return 1;
      }
      const proposal = await think(
        prompt,
        { noCache: opts.noCache },
        async () => "",
      );
      printOut(
        opts,
        proposal,
        `Proposal "${proposal.title}" saved. Next: orion draft ${proposal.title}`,
      );
      return 0;
    }
  }
}
