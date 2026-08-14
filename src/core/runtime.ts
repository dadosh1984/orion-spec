import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  chmodSync,
  rmSync,
  openSync,
  closeSync,
  unlinkSync,
  appendFileSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";
import { scanHazardsForRuntime } from "./hazards.js";
import { denyEnv } from "./denyEnv.js";
import { validateOutput } from "./specValidator.js";
import {
  recordTokenEvent,
  updateSkillMetrics,
  estimateBaselineTokens,
} from "./tokenLedger.js";
import { recordRepairAttempt, policyCheck, sandboxEnv } from "./repair.js";
import { runInDocker, sandboxLevel } from "./docker.js";
import { sha256 } from "../utils/hash.js";

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

/** In-memory hazard-scan cache keyed by sha256(script) (v0.48). */
const hazardCache = new Map<string, string[]>();

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
  /** Search tags — vocabulary the BM25 matcher scores against (v0.51). */
  tags?: string[];
  /** Domain this skill belongs to (onec | contracts | general ...). The
   * BM25 matcher filters by domain BEFORE scoring to avoid cross-domain
   * false positives like «создать запись» across unrelated contexts. */
  domain?: string;
  /** Fingerprint of the runtime environment this skill was built against
   * (e.g. schema 1C_TI vs 1C_TI_NEW). Phase 4 invalidates skills whose
   * backing environment drifts — recorded now, enforced later. */
  environmentFingerprint?: string;
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
  /** SHA-256 of (args + script file) from the last run (v0.47) — lets idempotent runs skip re-execution. */
  lastRunHash?: string;
  /** Post-run verification conditions (v0.48). Checked after successful execution. */
  postconditions?: Array<{
    type: "json_field" | "metric" | "file_exists";
    field?: string;
    equals?: unknown;
    path?: string;
    min?: number;
  }>;
}

export function scriptsDir(): string {
  return process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion", "scripts");
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
      const out = execSync(`command -v ${cmd} 2>/dev/null || true`, {
        encoding: "utf8",
      }).trim();
      return out || null;
    } catch {
      return null;
    }
  }
  const exts = (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .filter(Boolean);
  const dirs = (process.env.PATH || "").split(pathDelimiter());
  // Case-insensitive name lookup on Windows.
  const lname = cmd.toLowerCase();
  for (const dir of dirs) {
    if (!dir) continue;
    const candidates = [cmd, ...exts.map((e) => cmd + e.toLowerCase())];
    for (const cand of candidates) {
      const full = join(dir, cand);
      try {
        if (
          existsSync(full) &&
          lname === full.split(/[\\/]/).pop()!.split(".")[0].toLowerCase()
        ) {
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
  // Check user preference from orionTdd.json (v0.48).
  try {
    const cfgPath = join(
      import.meta.dirname ?? ".",
      "..",
      "config",
      "orionTdd.json",
    );
    if (existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as {
        run?: { preferredRuntime?: string };
      };
      const pref = cfg.run?.preferredRuntime;
      if (pref === "bash" || pref === "node" || pref === "python") {
        if (resolveBinary(pref)) return pref;
      }
    }
  } catch {
    /* config not critical */
  }
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
  return join(scriptsDir(), name, `run${scriptExt(m.runtime)}`);
}

/** File extension for a runtime (v0.48). */
export function scriptExt(
  runtime: "bash" | "node" | "python",
): ".sh" | ".js" | ".py" {
  return runtime === "node" ? ".js" : runtime === "python" ? ".py" : ".sh";
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
  writeFileSync(
    manifestPath(m.name),
    JSON.stringify(m, null, 2) + "\n",
    "utf8",
  );
}

/** List all saved scripts (newest first). */
export function listScripts(): RunManifest[] {
  const dir = scriptsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(manifestPath(d.name)))
    .map((d) => readManifest(d.name)!)
    .filter((m): m is RunManifest => m !== null)
    .sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
    );
}

/** Создать новый скрипт из шаблона. */
export function createScript(
  name: string,
  runtime: "bash" | "node" | "python",
  description: string,
  meta?: { tags?: string[]; domain?: string; environmentFingerprint?: string },
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
    tags: meta?.tags,
    domain: meta?.domain ?? (process.env.ORION_DOMAIN?.trim() || "general"),
    environmentFingerprint: meta?.environmentFingerprint,
  };
  writeManifest(m);
  return m;
}

// 3.12/3.4: streaming child execution with an output cap and abort/timeout.
// Below 1 MiB the output stays in memory; anything over spills to
// ~/.orion/last-output.log (kept, not dropped) and the CLI is told honestly
// the result was truncated. AbortSignal (SIGINT) and a timeout (via
// ORION_RUN_TIMEOUT_MS or a configured sandbox timeout_sec) kill the child.
const OUTPUT_CAP = 1024 * 1024; // 1 MiB in-memory cap
function overflowLogPath(): string {
  const dir = process.env.ORION_SCRIPTS_DIR ?? join(homedir(), ".orion");
  return join(dir, "last-output.log");
}

interface ChildRunResult {
  output: string;
  truncated: boolean;
  killed: boolean;
  durationMs: number;
}

function runChildWithLimit(
  bin: string,
  args: string[],
  opts: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number; // 0 = no timeout
  },
): Promise<ChildRunResult> {
  return new Promise((resolve, reject) => {
    const ac = new AbortController();
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: opts.env as Record<string, string>,
      signal: ac.signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let soFar = "";
    let pending = "";
    let truncated = false;
    let aborted = false;
    const started = Date.now();

    child.stdout?.on("data", (buf: Buffer) => {
      const chunk = buf.toString("utf8");
      if (soFar.length < OUTPUT_CAP) {
        const room = OUTPUT_CAP - soFar.length;
        soFar += chunk.slice(0, room);
        if (chunk.length > room) {
          truncated = true;
          pending += chunk.slice(room);
        }
      } else {
        // Already at/over the cap → this chunk is overflow too.
        truncated = true;
        pending += chunk;
      }
      if (pending.length) {
        try {
          flushOverflow(pending);
          pending = "";
        } catch {
          /* log write must never break the child */
        }
      }
    });
    child.stderr?.on("data", (buf: Buffer) => process.stderr.write(buf));

    const timer =
      opts.timeoutMs > 0
        ? setTimeout(() => {
            aborted = true;
            ac.abort();
            child.kill("SIGTERM");
          }, opts.timeoutMs)
        : null;

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      // An aborted/`killed` child surfaces as a spawn error on some platforms;
      // that is the normal timeout path, not a real failure to spawn.
      if (aborted || ac.signal.aborted) {
        resolve({
          output: `${soFar}\n[truncated: script killed by timeout]`,
          truncated,
          killed: true,
          durationMs: Date.now() - started,
        });
      } else {
        reject(err);
      }
    });
    child.on("close", () => {
      if (timer) clearTimeout(timer);
      resolve({
        output: aborted
          ? `${soFar}\n[truncated: script killed by timeout]`
          : soFar,
        truncated,
        killed: aborted,
        durationMs: Date.now() - started,
      });
    });
  });
}

/** Append overflow bytes to the shared log (bounded, keeps only the tail). */
function flushOverflow(content: string): void {
  const f = overflowLogPath();
  appendFileSync(f, content, "utf8");
  // Bound: keep the file under ~2 MiB by trimming the oldest half if over.
  try {
    const faSize = existsSync(f) ? statSync(f).size : 0;
    if (faSize > 2 * OUTPUT_CAP) {
      // rewrite keeping the tail half (best-effort)
      const text = readFileSync(f, "utf8");
      writeFileSync(f, text.slice(text.length - OUTPUT_CAP), "utf8");
    }
  } catch {
    /* non-fatal */
  }
}

/** Запустить скрипт и вернуть stdout + время выполнения. */
export async function runScript(
  name: string,
  opts?: { force?: boolean; dryRun?: boolean; args?: string[] },
): Promise<{ ok: boolean; output: string; durationMs: number }> {
  const m = readManifest(name);
  if (!m) {
    return { ok: false, output: `script "${name}" not found`, durationMs: 0 };
  }

  const scriptFile = scriptPath(name);
  if (!existsSync(scriptFile)) {
    return {
      ok: false,
      output: `script file not found: ${scriptFile}`,
      durationMs: 0,
    };
  }

  // Read script once for both cache hash and hazard scan (v0.48).
  const code = readFileSync(scriptFile, "utf8");

  // Deterministic re-run cache (v0.48): hash of script content + normalized args
  // + key env vars. Identical inputs skip re-execution (override with --force
  // or ORION_RUN_NO_CACHE=1).
  const args = opts?.args ?? [];
  const inputHash = sha256(
    JSON.stringify({
      script: sha256(code),
      args,
      env: {
        ORION_SANDBOX_NETWORK: process.env.ORION_SANDBOX_NETWORK ?? "",
      },
    }),
  );
  if (
    !opts?.force &&
    process.env.ORION_RUN_NO_CACHE !== "1" &&
    m.lastRunHash === inputHash &&
    m.lastRun !== null
  ) {
    return {
      ok: true,
      output: `[cached ${m.runtime} run] ${name}${args.length ? " " + args.join(" ") : ""} — inputs unchanged since ${m.lastRun}`,
      durationMs: 0,
    };
  }

  // Dry-run (v0.48): human-readable preview instead of raw JSON.
  if (opts?.dryRun) {
    const code = readFileSync(scriptFile, "utf8");
    const lines = code.split("\n").length;
    const sandbox = sandboxLevel();
    const network = m.sandbox?.network ?? "denied";
    const cacheHit = m.lastRunHash === inputHash && m.lastRun !== null;
    return {
      ok: true,
      output: [
        `[dry-run] ${m.runtime} script "${name}"`,
        `  Lines:       ${lines}`,
        `  Runtime:     ${m.runtime}`,
        `  Sandbox:     ${sandbox}`,
        `  Network:     ${network}`,
        `  Cache:       ${cacheHit ? "HIT (would skip)" : "cold (would execute)"}`,
        `  Description: ${m.description}`,
        m.risk_level ? `  Risk:        ${m.risk_level}` : "",
        m.requires_confirmation ? `  Confirm:     required` : "",
        m.schedule ? `  Schedule:    ${m.schedule}` : "",
        "",
        `  Run:         orion run ${name}`,
        `  Force:       orion run ${name} --force`,
      ]
        .filter((l) => l !== "")
        .join("\n"),
      durationMs: 0,
    };
  }

  // Hazard gate + policy: skip with --force or ORION_RUN_NO_HAZARDS=1.
  const force = opts?.force || process.env.ORION_RUN_NO_HAZARDS === "1";

  // Browser sandbox (v0.50): execute in real Chromium via optional playwright.
  // In this mode the script receives a `page`/`fetch` context (run(ctx)) or is
  // pointed at BROWSER_URL and we return the rendered HTML for its parser.
  if (sandboxLevel() === "browser") {
    const { runInBrowser } = await import("./browser.js");
    const bres = await runInBrowser(name, scriptFile, m, args);
    if (bres.ok) {
      m.lastRun = new Date().toISOString();
      m.runCount = (m.runCount ?? 0) + 1;
      writeManifest(m);
      recordTokenEvent({
        skillName: name,
        mode: "run",
        tokensIn: 0,
        tokensSaved: estimateBaselineTokens(m.description?.length ?? 0),
        baselineTokens: estimateBaselineTokens(m.description?.length ?? 0),
        status: "success",
        durationMs: bres.durationMs,
      });
      updateSkillMetrics(name, {
        success: true,
        tokensSaved: estimateBaselineTokens(m.description?.length ?? 0),
        durationMs: bres.durationMs,
        mode: "run",
        tokensIn: 0,
      });
    }
    return bres;
  }

  // Docker sandbox (v0.45): execute in container if ORION_SANDBOX=docker
  if (sandboxLevel() === "docker") {
    const result = runInDocker(name, scriptFile, m);
    if (result.ok) {
      m.lastRun = new Date().toISOString();
      m.runCount = (m.runCount ?? 0) + 1;
      writeManifest(m);
      recordTokenEvent({
        skillName: name,
        mode: "run",
        tokensIn: 0,
        tokensSaved: estimateBaselineTokens(m.description?.length ?? 0),
        baselineTokens: estimateBaselineTokens(m.description?.length ?? 0),
        status: "success",
        durationMs: result.durationMs,
      });
      updateSkillMetrics(name, {
        success: true,
        tokensSaved: estimateBaselineTokens(m.description?.length ?? 0),
        durationMs: result.durationMs,
        mode: "run",
        tokensIn: 0,
      });
    }
    return result;
  }

  // Policy check (v0.42): risk_level, requires_confirmation
  const policyError = policyCheck(m);
  if (policyError && !force) {
    return { ok: false, output: policyError, durationMs: 0 };
  }

  // Hazard gate (v0.39.2): scan script for destructive patterns BEFORE execution.
  // Cache by sha256(script) to avoid re-scanning on every run (v0.48).
  // https:// fetch is allowed when the skill explicitly opts out of network
  // denial (sandbox.network === "allowed"); http:// and destructive patterns
  // are still blocked (v0.49).
  if (!force) {
    const codeHash = sha256(code);
    const allowHttps = m.sandbox?.network === "allowed";
    const isLowRisk = m.risk_level === "low" || m.risk_level === undefined;
    // Cache key must include the policy flags — different flags mean a
    // different result for the same script content.
    const cacheKey = `${codeHash}:https=${allowHttps}:exit=${isLowRisk}`;
    let hits = hazardCache.get(cacheKey);
    if (hits === undefined) {
      hits = scanHazardsForRuntime(code, m.runtime, {
        allowHttps,
        allowOwnExit: isLowRisk,
      });
      hazardCache.set(cacheKey, hits);
    }
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
    // 3.8/3.13: argv-safe execution (no shell interpolation) + denyEnv so a
    // script name can't inject shell and secrets never reach the child env.
    const bin: string =
      m.runtime === "node"
        ? process.execPath
        : m.runtime === "python"
          ? (resolveBinary(
              process.platform === "win32" ? "python" : "python3",
            ) ?? (process.platform === "win32" ? "python" : "python3"))
          : (resolveBinary("bash") ?? "bash");
    const env = denyEnv(process.env);
    env["ORION_RUN_NAME"] = name;
    // 3.4/3.12: streaming child with output cap (1 MiB → last-output.log),
    // abort signal (SIGINT) and an optional timeout (ORION_RUN_TIMEOUT_MS;
    // a configured sandbox timeout_sec, if any, also applies).
    const hardTimeout = m.sandbox?.timeout_sec
      ? m.sandbox.timeout_sec * 1000
      : 0;
    const envTimeout = Number(process.env.ORION_RUN_TIMEOUT_MS ?? 0);
    const timeoutMs = hardTimeout || envTimeout;
    const res = await runChildWithLimit(bin, [scriptFile], {
      cwd: join(scriptsDir(), name),
      env: { ...env, ...sandboxEnv(m) },
      timeoutMs,
    });
    const output = res.output;
    const durationMs = res.durationMs;
    if (res.truncated) {
      process.stderr.write(
        `[warn] output truncated (1 MiB cap), full log: ${overflowLogPath()}\n`,
      );
    }

    // Update stats
    m.lastRun = new Date().toISOString();
    m.runCount = (m.runCount ?? 0) + 1;
    m.lastRunHash = inputHash;
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

  withCronLock(() => {
    // Удаляем старую cron-запись
    unscheduleCronLocked(name);

    if (cronExpr) {
      const scriptFile = scriptPath(name);
      const cronLine = `${cronExpr} cd ${join(scriptsDir(), name)} && bash "${scriptFile}" # orion:${name}`;
      try {
        const existing = execSync("crontab -l 2>/dev/null || true", {
          encoding: "utf8",
        });
        const cleaned = existing
          .split("\n")
          .filter((l) => !l.includes(`# orion:${name}`))
          .join("\n")
          .trim();
        const next = (cleaned ? cleaned + "\n" : "") + cronLine + "\n";
        execSync("crontab -", { input: next, encoding: "utf8" });
      } catch (err) {
        throw new Error(
          `cron setup failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    m.schedule = cronExpr;
    writeManifest(m);
  });
}

/** Убрать cron-запись для скрипта. */
export function unscheduleCron(name: string): void {
  assertCronSupported();
  withCronLock(() => unscheduleCronLocked(name));
}

function unscheduleCronLocked(name: string): void {
  try {
    const existing = execSync("crontab -l 2>/dev/null || true", {
      encoding: "utf8",
    });
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

/**
 * Atomic cron lock via O_EXCL (v0.48). Prevents parallel schedule/unschedule
 * from corrupting the crontab. Retries up to 10 times with 50ms backoff.
 */
function withCronLock(fn: () => void): void {
  const lockPath = join(scriptsDir(), "..", ".cron.lock");
  mkdirSync(join(scriptsDir(), ".."), { recursive: true });
  let fd: number | undefined;
  for (let i = 0; i < 10; i++) {
    try {
      fd = openSync(lockPath, "wx");
      break;
    } catch {
      if (i < 9) {
        const ms = 50 * (i + 1);
        const start = Date.now();
        while (Date.now() - start < ms) {
          /* spin */
        }
      }
    }
  }
  if (fd === undefined)
    throw new Error(
      "cron lock timeout — another schedule/unschedule is in progress",
    );
  try {
    fn();
  } finally {
    try {
      closeSync(fd);
      unlinkSync(lockPath);
    } catch {
      /* ok */
    }
  }
}
