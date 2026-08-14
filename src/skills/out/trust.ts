/**
 * export-trust (v0.55, task 4.4) — hash-based proof for external verification.
 *
 * A caller (a colleague, another tool, an auditor) can PROVE a change's
 * artifacts (proposal/tasks/spec/tests) and its Honest Receipt were not
 * altered after `export-trust` ran. Hash-based only — NO crypto signatures
 * (GPG/SSH/blockchain are consciously out of scope for v1): the trust file
 * plus the recorded hashes let anyone re-derive and compare the artifacts.
 *
 * Deterministic: same artifacts + same receipt → byte-identical trust.json.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";

export interface TrustArtifact {
  sha256: string;
  size: number;
}

export interface TrustData {
  change: string;
  ts: string;
  artifacts: {
    proposal: TrustArtifact;
    tasks: TrustArtifact;
    spec: TrustArtifact;
    tests: TrustArtifact;
  };
  testCount: number;
  /** Full embedded receipt (honesty carries over). */
  receipt: unknown;
  /** sha256 over the sorted artifacts + receipt — the tamper-evident root. */
  integrity: string;
}

function sha256(buf: string | Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function fileArtifact(p: string): TrustArtifact | null {
  if (!existsSync(p)) return null;
  const content = readFileSync(p);
  return { sha256: sha256(content), size: content.length };
}

/** Deterministic dir hash: sorted file paths, each hashed with its content. */
function dirArtifact(dir: string): {
  sha256: string;
  size: number;
  files: number;
} {
  const hash = createHash("sha256");
  let size = 0;
  let files = 0;
  if (existsSync(dir)) {
    const walk = (base: string): void => {
      for (const ent of readdirSync(base).sort()) {
        const p = join(base, ent);
        if (statSync(p).isDirectory()) walk(p);
        else {
          const content = readFileSync(p);
          hash.update(p + "\n");
          hash.update(content);
          size += content.length;
          files++;
        }
      }
    };
    walk(dir);
  }
  return { sha256: hash.digest("hex"), size, files };
}

/** Build the trust record for a change (deterministic). */
export function exportTrust(changeId: string): TrustData | null {
  const base = `changes/${changeId}`;
  if (!existsSync(`${base}/proposal.json`)) return null;
  const receiptPath = `${base}/receipt.json`;
  const receiptStr = existsSync(receiptPath)
    ? readFileSync(receiptPath, "utf8")
    : "{}";
  const receipt = JSON.parse(receiptStr) as unknown;

  const proposal = fileArtifact(`${base}/proposal.json`);
  const tasks = fileArtifact(`${base}/tasks.md`);
  const spec = fileArtifact(`${base}/specs/core/spec.md`);
  const tests = dirArtifact(`${base}/tests`);

  const artifacts = {
    proposal: proposal ?? { sha256: "", size: 0 },
    tasks: tasks ?? { sha256: "", size: 0 },
    spec: spec ?? { sha256: "not present", size: 0 },
    tests: { sha256: tests.sha256, size: tests.size },
  };

  const canonical = JSON.stringify({ artifacts, receipt });
  const trust: TrustData = {
    change: changeId,
    ts: (receipt as { ts?: string })?.ts ?? new Date(0).toISOString(),
    artifacts,
    testCount: tests.files,
    receipt,
    integrity: sha256(canonical),
  };

  const path = `${base}/trust.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(trust, null, 2), "utf8");
  return trust;
}

export interface VerifyTrustResult {
  ok: boolean;
  change: string;
  /** Artifact names whose on-disk hash differs from the recorded trust file. */
  tampered: string[];
  integrityOk: boolean;
  detail: string;
}

/** Verify a trust.json: recompute artifact hashes + integrity, compare. */
export function verifyTrust(changeId: string): VerifyTrustResult {
  const path = `changes/${changeId}/trust.json`;
  if (!existsSync(path)) {
    return {
      ok: false,
      change: changeId,
      tampered: [],
      integrityOk: false,
      detail: "no trust.json — run `orion export-trust <id>` first.",
    };
  }
  try {
    const trust = JSON.parse(readFileSync(path, "utf8")) as TrustData;
    // Recompute current artifact hashes from disk.
    const proposal = fileArtifact(`changes/${changeId}/proposal.json`);
    const tasks = fileArtifact(`changes/${changeId}/tasks.md`);
    const spec = fileArtifact(`changes/${changeId}/specs/core/spec.md`);
    const tests = dirArtifact(`changes/${changeId}/tests`);

    const tampered: string[] = [];
    const check = (
      name: string,
      got: TrustArtifact | null,
      expect: TrustArtifact,
    ): void => {
      const cur = (got?.sha256 ?? "not present") + "|" + (got?.size ?? 0);
      const exp = (expect?.sha256 ?? "not present") + "|" + (expect?.size ?? 0);
      if (cur !== exp) tampered.push(name);
    };
    check("proposal", proposal, trust.artifacts.proposal);
    check("tasks", tasks, trust.artifacts.tasks);
    check("spec", spec, trust.artifacts.spec);
    check(
      "tests",
      { sha256: tests.sha256, size: tests.size },
      {
        sha256: trust.artifacts.tests.sha256,
        size: trust.artifacts.tests.size,
      },
    );

    // Recompute the integrity root exactly as exportTrust did, and compare.
    const canonical = JSON.stringify({
      artifacts: trust.artifacts,
      receipt: trust.receipt,
    });
    const integrityOk = sha256(canonical) === trust.integrity;
    const ok = tampered.length === 0 && integrityOk;
    return {
      ok,
      change: changeId,
      tampered,
      integrityOk,
      detail: ok
        ? `trust verified — ${trust.testCount} test file(s), integrity root matches.`
        : [
            tampered.length
              ? `tampered artifact(s): ${tampered.join(", ")}`
              : "",
            !integrityOk ? "integrity root mismatch" : "",
          ]
            .filter(Boolean)
            .join("; "),
    };
  } catch {
    return {
      ok: false,
      change: changeId,
      tampered: [],
      integrityOk: false,
      detail: "trust.json unreadable/corrupt.",
    };
  }
}
