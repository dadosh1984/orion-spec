import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, chmodSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { scanHazardsForRuntime } from "./hazards.js";
import { validateOutput } from "./specValidator.js";
import { recordTokenEvent, updateSkillMetrics, estimateBaselineTokens } from "./tokenLedger.js";

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
}

export function scriptsDir(): string {
  return (
    process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion", "scripts")
  );
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

  // Hazard gate (v0.39.2): scan script for destructive patterns BEFORE execution.
  // Skip with --force or ORION_RUN_NO_HAZARDS=1.
  const force = opts?.force || process.env.ORION_RUN_NO_HAZARDS === "1";
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
      cmd = `node "${scriptFile}"`;
    } else if (m.runtime === "python") {
      cmd = `python3 "${scriptFile}"`;
    } else {
      cmd = `bash "${scriptFile}"`;
    }
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: 30_000,
      cwd: join(scriptsDir(), name),
      env: { ...process.env, ORION_RUN_NAME: name },
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
    return {
      ok: false,
      output: err instanceof Error ? err.message : String(err),
      durationMs,
    };
  }
}

/** Удалить скрипт и его директорию. */
export function deleteScript(name: string): void {
  const m = readManifest(name);
  if (!m) throw new Error(`script "${name}" not found`);
  rmSync(join(scriptsDir(), name), { recursive: true, force: true });
}

/** Обновить cron-расписание. Только linux/mac. */
export function setSchedule(name: string, cronExpr: string | null): void {
  const m = readManifest(name);
  if (!m) throw new Error(`script "${name}" not found`);

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
