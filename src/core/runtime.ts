import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { scanHazardsForRuntime } from "./hazards.js";
import { validateOutput } from "./specValidator.js";
import { recordTokenEvent, updateSkillMetrics, estimateBaselineTokens } from "./tokenLedger.js";
import { recordRepairAttempt, policyCheck, sandboxEnv } from "./repair.js";
import { runInDocker, sandboxLevel } from "./docker.js";

/**
 * `orion run` runtime (v0.39) — локальные автономные скрипты.
 *
 * Каждый скрипт живёт в ~/.orion/scripts/<name>/:
 *   run.sh (или run.js) — исполняемый файл
 *   orion.json           — метаданные
 *
 * Идея: ИИ создаёт скрипт ОДИН раз (тратя токены), а запускается он
 * бесконечно через `orion run <name>` — без токенов, без интернета.
 */

export interface RunManifest {
  name: string;
  description: string;
  runtime: "bash" | "node" | "python";
  created: string;
  lastRun: string | null;
  runCount: number;
  /** Cron expression from `orion run schedule` (null if not scheduled). */
  schedule: string | null;
  /** Source change id if created via `forge --save-as`. */
  sourceChange?: string;
  /** Spec-driven output validation schema (v0.39). */
  outputSchema?: {
    required?: string[];
    properties?: Record<string, { type: string }>;
  };
  /** Входные параметры (ключи из INPUT_JSON, которые скрипт ожидает). */
  inputs?: string[];
  /** Timestamp последнего запуска с --force (обход hazard gate). */
  lastForceRun?: string;
  /** Risk level: low | medium | high | critical (v0.42). */
  risk_level?: "low" | "medium" | "high" | "critical";
  /** Требуется подтверждение перед запуском (v0.42). */
  requires_confirmation?: boolean;
  /** Необратимая операция (v0.42). */
  irreversible?: boolean;
  /** Sandbox configuration (v0.42). */
  sandbox?: {
    network?: "allowed" | "denied";
    timeout_sec?: number;
    max_memory_mb?: number;
    max_cpu_percent?: number;
  };
  /** Состояние навыка: active | broken | needs_repair (v0.42). */
  status?: "active" | "broken" | "needs_repair";
}

export function scriptsDir(): string {
  return (
    process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion", "scripts")
  );
}

/**
 * Cross-platform availability (v0.47):
 * True when `cmd` resolves to an executable on the current PATH as seen by
 * this process. On Windows the spawned context may strip PATH (e.g. the
 * pnpm-shim), so `node` stays available via process.execPath but `bash` may
 * not — `whichExists` reports the truth for that context.
 */
export function whichExists(cmd: string): boolean {
  return resolveBinary(cmd) !== null;
}

/**
 * Resolve the absolute path of an executable on this process's PATH, or null
 * if not found. Returns e.g. "C:\\Program Files\\Git\\bin\\bash.exe". Used to
 * invoke runtimes by absolute path so they resolve even when the spawn context
 * (cmd.exe on Windows) does not inherit the full PATH.
 */
export function resolveBinary(cmd: string): string | null {
  if (process.platform !== "win32") {
    try {
      const out = execSync(`command -v ${cmd} 2>/dev/null || true`, { encoding: "utf8" }).trim();
      return out || null;
    } catch {
      return null;
    }
  }
  const exts = (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean);
  const dirs = (process.env.PATH || "").split(pathDelimiter());
  // Case-insensitive name lookup on Windows.
  const lname = cmd.toLowerCase();
  for (const dir of dirs) {
    if (!dir) continue;
    const candidates = [cmd, ...exts.map((e) => cmd + e.toLowerCase())];
    for (const cand of candidates) {
      const full = join(dir, cand);
      try {
        if (existsSync(full) && lname === full.split(/[\\/]/).pop()!.split(".")[0].toLowerCase()) {
          return full;
        }
      } catch {
        /* ignore unreadable dir */
      }
    }
  }
  return null;
}

function pathDelimiter(): string {
  return process.platform === "win32" ? ";" : ":";
}

/**
 * Default runtime for `orion run new` (v0.47):
 * Prefer bash, but fall back to node when bash is unavailable in this
 * process's PATH (common on Windows spawned context like the pnpm-shim).
 * node is always runnable because we invoke it via process.execPath.
 */
export function detectDefaultRuntime(): "bash" | "node" | "python" {
  if (resolveBinary("bash")) return "bash";
  if (process.execPath) return "node";
  if (resolveBinary("python") || resolveBinary("python3")) return "python";
  return "node";
}


export function manifestPath(name: string): string {
  return join(scriptsDir(), name, "orion.json");
}

export function scriptPath(name: string): string {
  const m = readManifest(name);
  if (!m) return join(scriptsDir(), name, "run.sh");
  const ext = m.runtime === "node" ? ".js" : m.runtime === "python" ? ".py" : ".sh";
  return join(scriptsDir(), name, `run${ext}`);
}

/** Read manifest; null if missing or corrupt. */
export function readManifest(name: string): RunManifest | null {
  try {
    const path = manifestPath(name);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8")) as RunManifest;
  } catch {
    return null;
  }
}

/** Write manifest (create dirs). */
export function writeManifest(m: RunManifest): void {
  const dir = join(scriptsDir(), m.name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(manifestPath(m.name), JSON.stringify(m, null, 2) + "\n", "utf8");
}

/** List all saved scripts (newest first). */
export function listScripts(): RunManifest[] {
  const dir = scriptsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(manifestPath(d.name)))
    .map((d) => readManifest(d.name)!)
    .filter((m): m is RunManifest => m !== null)
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

/** Создать новый скрипт из шаблона. */
export function createScript(
  name: string,
  runtime: "bash" | "node" | "python",
  description: string,
): RunManifest {
  const dir = join(scriptsDir(), name);
  if (existsSync(manifestPath(name))) {
    throw new Error(`script "${name}" already exists — use a different name`);
  }
  mkdirSync(dir, { recursive: true });

  const templates: Record<string, string> = {
    bash: `#!/usr/bin/env bash\n# Orion script: ${name}\n# ${description}\nset -euo pipefail\n\necho "Hello from ${name}!"\n`,
    node: `#!/usr/bin/env node\n// Orion script: ${name}\n// ${description}\n\nconsole.log("Hello from ${name}!");\n`,
    python: `#!/usr/bin/env python3\n"""Orion script: ${name}\n${description}"""\n\nprint("Hello from ${name}!")\n`,
  };

  const ext = runtime === "node" ? ".js" : runtime === "python" ? ".py" : ".sh";
  const scriptFile = join(dir, `run${ext}`);
  writeFileSync(scriptFile, templates[runtime], "utf8");

  // Make executable on unix
  try {
    chmodSync(scriptFile, 0o755);
  } catch {
    /* Windows — ok */
  }

  const m: RunManifest = {
    name,
    description,
    runtime,
    created: new Date().toISOString(),
    lastRun: null,
    runCount: 0,
    schedule: null,
  };
  writeManifest(m);
  return m;
}

/** Запустить скрипт и вернуть stdout + время выполнения. */
export function runScript(
  name: string,
  opts?: { force?: boolean; dryRun?: boolean },
): { ok: boolean; output: string; durationMs: number } {
  const m = readManifest(name);
  if (!m) {
    return { ok: false, output: `script "${name}" not found`, durationMs: 0 };
  }

  const scriptFile = scriptPath(name);
  if (!existsSync(scriptFile)) {
    return { ok: false, output: `script file not found: ${scriptFile}`, durationMs: 0 };
  }

  // Dry-run (v0.41): не выполняем, возвращаем что БЫЛО БЫ сделано
  if (opts?.dryRun) {
    const code = readFileSync(scriptFile, "utf8");
    const lines = code.split("\n").length;
    return {
      ok: true,
      output: JSON.stringify({
        status: "dry_run_success",
        summary: `Would execute ${m.runtime} script "${name}" (${lines} lines)`,
        metrics: {
          would_execute: true,
          script_lines: lines,
          runtime: m.runtime,
          description: m.description,
        },
      }, null, 2),
      durationMs: 0,
    };
  }

  // Hazard gate + policy: skip with --force or ORION_RUN_NO_HAZARDS=1.
  const force = opts?.force || process.env.ORION_RUN_NO_HAZARDS === "1";

  // Docker sandbox (v0.45): execute in container if ORION_SANDBOX=docker
  if (sandboxLevel() === "docker") {
    const result = runInDocker(name, scriptFile, m);
    if (result.ok) {
      m.lastRun = new Date().toISOString();
      m.runCount = (m.runCount ?? 0) + 1;
      writeManifest(m);
      recordTokenEvent({
        skillName: name, mode: "run", tokensIn: 0,
        tokensSaved: estimateBaselineTokens(m.description?.length ?? 0),
        baselineTokens: estimateBaselineTokens(m.description?.length ?? 0),
        status: "success", durationMs: result.durationMs,
      });
      updateSkillMetrics(name, { success: true, tokensSaved: estimateBaselineTokens(m.description?.length ?? 0), durationMs: result.durationMs, mode: "run", tokensIn: 0 });
    }
    return result;
  }

  // Policy check (v0.42): risk_level, requires_confirmation
  const policyError = policyCheck(m);
  if (policyError && !force) {
    return { ok: false, output: policyError, durationMs: 0 };
  }

  // Hazard gate (v0.39.2): scan script for destructive patterns BEFORE execution.
  if (!force) {
    const code = readFileSync(scriptFile, "utf8");
    const hits = scanHazardsForRuntime(code, m.runtime);
    if (hits.length > 0) {
      return {
        ok: false,
        output: `[hazard gate] script "${name}" blocked — ${hits.length} hazard(s):\n  - ${hits.join("\n  - ")}\nRe-run with --force to override.`,
        durationMs: 0,
      };
    }
  }

  // Log force override (v0.39.2) — visible in `orion run show`
  if (force) {
    m.lastForceRun = new Date().toISOString();
    writeManifest(m);
  }

  const start = Date.now();
  try {
    let cmd: string;
    if (m.runtime === "node") {
      // Use the current interpreter's absolute path: resolves even when the
      // spawned context has a stripped PATH (e.g. Windows pnpm-shim).
      cmd = `"${process.execPath}" "${scriptFile}"`;
    } else if (m.runtime === "python") {
      // `python` on Windows, `python3` on Linux/macOS (v0.47). Resolve the
      // absolute path so it survives a stripped spawn context.
      const py = process.platform === "win32" ? "python" : "python3";
      cmd = `"${resolveBinary(py) ?? py}" "${scriptFile}"`;
    } else {
      // bash by absolute path (v0.47): `bash` alone can fail on Windows when
      // cmd.exe doesn't inherit the full PATH from the pnpm-shim spawn.
      cmd = `"${resolveBinary("bash") ?? "bash"}" "${scriptFile}"`;
    }
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: m.sandbox?.timeout_sec ? m.sandbox.timeout_sec * 1000 : 30_000,
      cwd: join(scriptsDir(), name),
      env: { ...process.env, ...sandboxEnv(m), ORION_RUN_NAME: name },
    });
    const durationMs = Date.now() - start;

    // Update stats
    m.lastRun = new Date().toISOString();
    m.runCount = (m.runCount ?? 0) + 1;
    writeManifest(m);

    // Spec-driven validation (v0.39): проверить stdout по outputSchema
    const validation = validateOutput(output.trim(), m.outputSchema);

    // Token ledger (v0.41): записать событие и обновить метрики
    const baseline = estimateBaselineTokens(m.description?.length ?? 0);
    const saved = baseline; // локальный запуск — 0 токенов LLM
    recordTokenEvent({
      skillName: name,
      mode: "run",
      tokensIn: 0,
      tokensSaved: saved,
      baselineTokens: baseline,
      status: validation.ok ? "success" : "validation_failed",
      durationMs,
    });
    updateSkillMetrics(name, {
      success: validation.ok,
      tokensSaved: saved,
      durationMs,
      mode: "run",
      tokensIn: 0,
    });

    if (!validation.ok) {
      return {
        ok: false,
        output: `[validation] script ran (${durationMs}ms) but output failed spec check:\n  - ${validation.errors.join("\n  - ")}\nstdout: ${output.slice(0, 500)}`,
        durationMs,
      };
    }

    return { ok: true, output, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    // Repair log (v0.42): записать ошибку для будущего авто-ремонта
    const attempts = recordRepairAttempt(name, errMsg);
    const repairNote =
      attempts >= 2
        ? `\n[repair] ${attempts} failed attempts — run "orion run repair ${name}" to attempt auto-fix.`
        : "";
    return { ok: false, output: errMsg + repairNote, durationMs };
  }
}

/** Удалить скрипт и его директорию. */
export function deleteScript(name: string): void {
  const m = readManifest(name);
  if (!m) throw new Error(`script "${name}" not found`);
  rmSync(join(scriptsDir(), name), { recursive: true, force: true });
}

/**
 * Honest platform guard for cron scheduling (v0.47). On Windows there is no
 * `crontab`, so `schedule`/`unschedule` would fail with a cryptic error —
 * throw a clear message instead of silently relying on a missing binary.
 */
export function assertCronSupported(): void {
  if (process.platform === "win32") {
    throw new Error(
      "cron scheduling is supported only on Linux/macOS. " +
        "On Windows use a saved script with `orion run <name>` instead.",
    );
  }
}

/** Обновить cron-расписание. Только linux/mac. */
export function setSchedule(name: string, cronExpr: string | null): void {
  const m = readManifest(name);
  if (!m) throw new Error(`script "${name}" not found`);

  assertCronSupported();

  // Удаляем старую cron-запись
  unscheduleCron(name);

  if (cronExpr) {
    const scriptFile = scriptPath(name);
    const cronLine = `${cronExpr} cd ${join(scriptsDir(), name)} && bash "${scriptFile}" # orion:${name}`;
    try {
      const existing = execSync("crontab -l 2>/dev/null || true", { encoding: "utf8" });
      const cleaned = existing
        .split("\n")
        .filter((l) => !l.includes(`# orion:${name}`))
        .join("\n")
        .trim();
      const next = (cleaned ? cleaned + "\n" : "") + cronLine + "\n";
      execSync("crontab -", { input: next, encoding: "utf8" });
    } catch (err) {
      throw new Error(`cron setup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  m.schedule = cronExpr;
  writeManifest(m);
}

/** Убрать cron-запись для скрипта. */
export function unscheduleCron(name: string): void {
  assertCronSupported();
  try {
    const existing = execSync("crontab -l 2>/dev/null || true", { encoding: "utf8" });
    const cleaned = existing
      .split("\n")
      .filter((l) => !l.includes(`# orion:${name}`) && l.trim() !== "")
      .join("\n");
    if (cleaned.trim()) {
      execSync("crontab -", { input: cleaned + "\n", encoding: "utf8" });
    } else {
      execSync("crontab -r 2>/dev/null || true");
    }
  } catch {
    /* best effort */
  }
}
