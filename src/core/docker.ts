/**
 * Docker sandbox for skill execution (v0.45).
 *
 * Когда ORION_SANDBOX=docker, runScript запускает скрипт внутри
 * docker-контейнера с ограниченной FS, без сети, с timeout.
 *
 * Использует образ orion:runtime из Dockerfile проекта.
 */

import { execSync } from "node:child_process";
import type { RunManifest } from "./runtime.js";
import { scriptExt } from "./runtime.js";

/** Проверить, доступен ли Docker. */
export function dockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/** Собрать docker run команду для безопасного выполнения навыка. */
export function dockerRunCommand(
  name: string,
  scriptPath: string,
  m: RunManifest,
): string {
  const image = process.env.ORION_DOCKER_IMAGE ?? "orion:runtime";
  const workDir = `/workspace/${name}`;
  const timeout = m.sandbox?.timeout_sec ?? 30;
  const memory = m.sandbox?.max_memory_mb
    ? `--memory=${m.sandbox.max_memory_mb}m`
    : "--memory=256m";
  const network = m.sandbox?.network === "allowed" ? "" : "--network none";
  const runtime =
    m.runtime === "node" ? "node" : m.runtime === "python" ? "python3" : "bash";

  const ext = scriptExt(m.runtime);
  return [
    "docker run --rm",
    network,
    memory,
    `--name orion-skill-${name}`,
    `-v "${scriptPath}:/script/${name}${ext}:ro"`,
    `-w ${workDir}`,
    `--stop-timeout ${timeout}`,
    `--cpus=0.5`,
    `-e ORION_SANDBOX_NETWORK=${network ? "0" : "1"}`,
    `-e ORION_RUN_NAME=${name}`,
    image,
    `${runtime} /script/${name}${ext}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Выполнить навык в Docker sandbox. */
export function runInDocker(
  name: string,
  scriptPath: string,
  m: RunManifest,
): { ok: boolean; output: string; durationMs: number } {
  if (!dockerAvailable()) {
    return {
      ok: false,
      output:
        "Docker sandbox requested but docker is not available. Set ORION_SANDBOX=basic or install Docker.",
      durationMs: 0,
    };
  }

  const cmd = dockerRunCommand(name, scriptPath, m);
  const start = Date.now();

  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      timeout: (m.sandbox?.timeout_sec ?? 30) * 1000 + 5000,
    });
    return {
      ok: true,
      output,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      output: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/** Выбрать sandbox: docker или basic (process). */
export function sandboxLevel(): "docker" | "basic" | "none" {
  const level = process.env.ORION_SANDBOX?.toLowerCase();
  if (level === "docker" && dockerAvailable()) return "docker";
  if (level === "basic" || !level) return "basic";
  return "none";
}
