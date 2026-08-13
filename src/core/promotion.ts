/**
 * Promotion proposal ledger (v0.52) — safe skill promotion state-machine.
 *
 * Replaces the binary "show / scaffold" with an explicit three-step flow:
 *   proposed → replayed → approved
 *
 * 1. `orion run match --propose "<sig>"` — snapshot the repeated miss-log
 *    signature + its historical input→output pairs into
 *    `.orion/proposals/<slug>.json`. Does NOT touch scripts/.
 * 2. `orion run match --replay <id>` — run the proposed script in shadow on
 *    the historical inputs, compare the output hash to the recorded
 *    resolution. Any drift blocks the promotion (state stays "proposed").
 * 3. `orion run match --approve <id>` — ONLY after a passing replay, move
 *    the files into scripts/ and record the promotion in economy.json.
 *
 * A silent auto-promote is impossible: each step is explicit and the replay
 * must actually pass before approve will act.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";

export type ProposalState = "proposed" | "replayed" | "approved" | "rejected";

export interface PromotionProposal {
  id: string;
  signature: string;
  domain: string;
  state: ProposalState;
  created: string;
  /** Historical miss-log entries (input→resolution pairs). */
  history: Array<{ step: string; resolution?: string }>;
  /** Path the candidate script lives at while proposed (before approve). */
  scriptPath?: string;
  /** Set after a passing replay. */
  replayScore?: number;
  replayTs?: string;
  /** Set after approve. */
  approvedTs?: string;
}

function proposalsDir(): string {
  const base =
    process.env.ORION_PROPOSALS_DIR ?? join(homedir(), ".orion", "proposals");
  return base;
}

function proposalFile(id: string): string {
  return join(proposalsDir(), `${id}.json`);
}

export function readProposal(id: string): PromotionProposal | null {
  const f = proposalFile(id);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as PromotionProposal;
  } catch {
    return null;
  }
}

export function listProposals(): PromotionProposal[] {
  const dir = proposalsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(
          readFileSync(join(dir, f), "utf8"),
        ) as PromotionProposal;
      } catch {
        return null;
      }
    })
    .filter((p): p is PromotionProposal => p !== null);
}

export function writeProposal(p: PromotionProposal): void {
  const dir = proposalsDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(proposalFile(p.id), JSON.stringify(p, null, 2), "utf8");
}

/** Create a proposal snapshot from a repeated miss-log signature. */
export function proposeFromMissLog(
  id: string,
  signature: string,
  domain: string,
  history: Array<{ step: string; resolution?: string }>,
): PromotionProposal {
  const p: PromotionProposal = {
    id,
    signature,
    domain,
    state: "proposed",
    created: new Date().toISOString(),
    history,
  };
  writeProposal(p);
  return p;
}

/**
 * Approve a replayed proposal: flip state to "approved", record a
 * promotion row in economy.json (ties the ledger to this skill via `source`)
 * and persist. Returns the updated proposal, or null if the proposal was
 * never replay-passed (a silent approve is impossible).
 */
export async function approveProposal(
  id: string,
): Promise<PromotionProposal | null> {
  const p = readProposal(id);
  if (!p) return null;
  if (p.state !== "replayed" || typeof p.replayScore === "undefined") {
    return null; // must pass replay first
  }
  p.state = "approved";
  p.approvedTs = new Date().toISOString();
  writeProposal(p);
  const { appendEconomy } = await import("./compress.js");
  appendEconomy({
    ts: p.approvedTs,
    cmd: `promote:${id}`,
    inBytes: 0,
    outBytes: 0,
    cached: false,
    source: {
      proposalId: id,
      promotedAt: Date.parse(p.approvedTs),
      replayScore: p.replayScore,
    },
  });
  return p;
}

/**
 * Replay-verify a proposal: run its script (shadow mode) on each historical
 * input and compare the normalized output to the recorded resolution. Any
 * mismatch keeps state "proposed" and reports the drift; a full pass sets
 * state "replayed" + replayScore (fraction of history that matched).
 */
export async function replayProposal(
  id: string,
  run: (args: string[]) => Promise<{ ok: boolean; output: string }>,
): Promise<{ state: ProposalState; replayScore: number; drift: string[] }> {
  const p = readProposal(id);
  if (!p) return { state: "proposed", replayScore: 0, drift: ["proposal not found"] };
  const entries = p.history.filter((h) => h.resolution && h.resolution.trim());
  if (entries.length === 0) {
    return { state: "proposed", replayScore: 0, drift: ["no historical resolution recorded to replay against"] };
  }
  let matched = 0;
  const drift: string[] = [];
  for (const h of entries) {
    const res = await run([h.step]);
    const actual = res.output.trim().replace(/\s+/g, " ");
    const expected = (h.resolution ?? "").trim().replace(/\s+/g, " ");
    if (res.ok && actual === expected) {
      matched++;
    } else {
      drift.push(`step="${h.step}" expected="${expected.slice(0, 60)}" got="${actual.slice(0, 60)}"`);
    }
  }
  const score = entries.length ? matched / entries.length : 0;
  const next: ProposalState = drift.length === 0 ? "replayed" : "proposed";
  p.state = next;
  p.replayScore = score;
  if (next === "replayed") p.replayTs = new Date().toISOString();
  writeProposal(p);
  return { state: next, replayScore: score, drift };
}
