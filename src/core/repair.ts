/**
 * Repair Loop + Policy Engine + Sandbox (v0.42).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { RunManifest } from "./runtime.js";

const MAX_REPAIR_ATTEMPTS = 2;
const REPAIR_LOG = ".orion/repair-log.json";

export interface RepairEntry {
  skillName: string;
  ts: string;
  error: string;
  attempt: number;
  fixed: boolean;
}

function repairLogPath(): string {
  return join(homedir(), REPAIR_LOG);
}

function readRepairLog(): RepairEntry[] {
  try {
    const p = repairLogPath();
    if (!existsSync(p)) return [];
    return JSON.parse(readFileSync(p, "utf8")) as RepairEntry[];
  } catch {
    return [];
  }
}

function writeRepairLog(entries: RepairEntry[]): void {
  try {
    const p = repairLogPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(entries.slice(-500), null, 2), "utf8");
  } catch {
    /* ok */
  }
}

export function recordRepairAttempt(skillName: string, error: string): number {
  const log = readRepairLog();
  const prev = log.filter((e) => e.skillName === skillName && !e.fixed).length;
  log.push({
    skillName,
    ts: new Date().toISOString(),
    error: error.slice(0, 500),
    attempt: prev + 1,
    fixed: false,
  });
  writeRepairLog(log);
  return prev + 1;
}

export function markRepairFixed(skillName: string): void {
  const log = readRepairLog();
  for (const e of [...log].reverse()) {
    if (e.skillName === skillName && !e.fixed) {
      e.fixed = true;
      break;
    }
  }
  writeRepairLog(log);
}

export function canAttemptRepair(skillName: string): boolean {
  return (
    readRepairLog().filter((e) => e.skillName === skillName && !e.fixed)
      .length < MAX_REPAIR_ATTEMPTS
  );
}

export function policyCheck(m: RunManifest): string | null {
  if (m.risk_level === "critical") {
    return `POLICY: skill "${m.name}" has risk_level=critical — requires explicit user approval.`;
  }
  if (m.risk_level === "high" && m.requires_confirmation !== false) {
    return `POLICY: skill "${m.name}" is high-risk. Run with --force or set requires_confirmation: false.`;
  }
  return null;
}

export function sandboxEnv(m: RunManifest): Record<string, string> {
  return {
    ORION_SANDBOX_NETWORK: m.sandbox?.network === "allowed" ? "1" : "0",
    ORION_SANDBOX_WORKSPACE: "1",
    HOME: process.env.HOME ?? process.env.USERPROFILE ?? "",
    PATH: "/usr/bin:/bin:/usr/local/bin",
    ...(m.sandbox?.timeout_sec
      ? { ORION_SANDBOX_TIMEOUT: String(m.sandbox.timeout_sec) }
      : {}),
    ...(m.sandbox?.max_memory_mb
      ? { ORION_SANDBOX_MAX_MEMORY: String(m.sandbox.max_memory_mb) }
      : {}),
  };
}
