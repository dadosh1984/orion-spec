// ponytail: rung-2 — aggregates existing data, no new storage

import { readLessons, lessonsStats } from "./lessons.js";
import { listProposals } from "./promotion.js";
import { economyStats } from "./compress.js";
import { countOpenDebt } from "./debt.js";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

/**
 * Self-audit (v0.67, Step C) — consolidated report of what Orion has
 * learned, how many errors it made and fixed, what skills it promoted,
 * and how many tokens it saved. Pure read-only aggregation.
 */
export interface SelfAuditReport {
  lessons: {
    total: number;
    errors: number;
    successPatterns: number;
    lastActivity: string | null;
    topFailures: Array<{ error: string; count: number }>;
  };
  repair: { attempts: number; fixed: number };
  promotion: {
    total: number;
    proposed: number;
    replayed: number;
    approved: number;
    rejected: number;
  };
  economy: { compressOps: number; savedTokens: number; openDebt: number };
  summary: string;
}

export function selfAudit(): SelfAuditReport {
  const all = readLessons();
  const errors = all.filter((l) => l.kind !== "success" || !l.kind);
  const successes = all.filter((l) => l.kind === "success");
  const { count, lastTs } = lessonsStats();

  const errorFreq = new Map<string, number>();
  for (const e of errors) {
    const key = e.error.slice(0, 80);
    errorFreq.set(key, (errorFreq.get(key) ?? 0) + 1);
  }
  const topFailures = [...errorFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([error, count]) => ({ error, count }));

  const repair = readRepairStats();
  const props = listProposals();
  const proposed = props.filter((p) => p.state === "proposed").length;
  const replayed = props.filter((p) => p.state === "replayed").length;
  const approved = props.filter((p) => p.state === "approved").length;
  const rejected = props.filter((p) => p.state === "rejected").length;
  const eco = economyStats();
  const open = countOpenDebt();

  const lines: string[] = [
    `🧠 Lessons: ${count} total (${errors.length} errors, ${successes.length} success patterns)`,
  ];
  if (topFailures.length) {
    lines.push("  Top failures:");
    for (const t of topFailures) lines.push(`    ×${t.count}: ${t.error}`);
  }
  if (repair.attempts > 0) {
    lines.push(
      `🔧 Repairs: ${repair.fixed}/${repair.attempts} resolved`,
      repair.attempts > repair.fixed
        ? `  ⚠️ ${repair.attempts - repair.fixed} still needing repair`
        : "  ✅ All repairs resolved",
    );
  }
  if (props.length) {
    lines.push(
      `🚀 Promotions: ${approved}/${props.length} approved (${proposed} proposed, ${replayed} replayed, ${rejected} rejected)`,
    );
  }
  if (eco.entries > 0) {
    lines.push(
      `💰 Token economy: ~${eco.savedTokens} tok saved across ${eco.entries} compress op(s)`,
    );
  }
  if (open > 0) lines.push(`   ${open} open yagni debt item(s)`);

  return {
    lessons: {
      total: count,
      errors: errors.length,
      successPatterns: successes.length,
      lastActivity: lastTs,
      topFailures,
    },
    repair,
    promotion: { total: props.length, proposed, replayed, approved, rejected },
    economy: {
      compressOps: eco.entries,
      savedTokens: eco.savedTokens,
      openDebt: open,
    },
    summary: lines.join("\n"),
  };
}

function readRepairStats(): { attempts: number; fixed: number } {
  try {
    const { existsSync, readFileSync } = _require("node:fs");
    const { join } = _require("node:path");
    const { homedir } = _require("node:os");
    const p = join(homedir(), ".orion", "repair-log.json");
    if (!existsSync(p)) return { attempts: 0, fixed: 0 };
    const raw = JSON.parse(readFileSync(p, "utf8")) as Array<{
      fixed: boolean;
    }>;
    return { attempts: raw.length, fixed: raw.filter((e) => e.fixed).length };
  } catch {
    return { attempts: 0, fixed: 0 };
  }
}
