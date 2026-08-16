/**
 * orion chat — autonomous change pipeline (v0.62).
 *
 * Full cycle: think → draft → clarify → forge → shield → out
 * Each step is visualised with timing, status and useful info.
 */

import { existsSync, readdirSync } from 'node:fs';
import { think } from '../skills/think/handler.js';
import { draft } from '../skills/draft/handler.js';
import { forge } from '../skills/forge/handler.js';
import { shield } from '../skills/shield/handler.js';
import { out } from '../skills/out/handler.js';
import {
  generateQuestions,
  hasUnansweredBlockers,
  applyAnswers,
} from '../core/clarify.js';
import { askWithFallback } from '../core/llm/index.js';
import { readVersionSafe } from '../utils/version.js';
import type { Answer } from '../core/clarify.js';

// ─── Visual ──────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const CHECK = '\u2713';
const CROSS = '\u2717';
const ARROW = '\u25B6';
const LINE = '\u2500';

function icon(ok: boolean): string {
  return ok ? `${GREEN}${CHECK}${RESET}` : `${RED}${CROSS}${RESET}`;
}

function elapsed(start: bigint): string {
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function rule(): void {
  console.log(`  ${GRAY}${LINE.repeat(48)}${RESET}`);
}

function resultLine(label: string, value: string, color = ''): void {
  console.log(`  ${BOLD}${label}:${RESET} ${color}${value}${RESET}`);
}

// ─── Chat command ────────────────────────────────────────
export async function chatCommand(prompt: string, auto = false, full = false): Promise<number> {
  const t0 = process.hrtime.bigint();

  console.log(`\n${BOLD}${CYAN}  Orion v${readVersionSafe()}${RESET} ${GRAY}— Autonomous Change Pipeline${RESET}\n`);

  // ── STEP 1/6: THINK ─────────────────────────
  const t1 = process.hrtime.bigint();
  let changeId = '';

  // Check for existing change first
  const maybeSlug = slugify(prompt);
  const changesDir = 'changes';
  let isReenter = false;

  if (existsSync(changesDir)) {
    const entries = readdirSync(changesDir);
    const existing = entries.find(e => e === maybeSlug || e.startsWith(maybeSlug));
    if (existing) {
      changeId = existing;
      isReenter = true;
      process.stderr.write(`${icon(true)} ${BOLD}STEP 1/6${RESET}: THINK     ${DIM}re-entering change: ${changeId}${RESET}\n`);
    }
  }

  if (!changeId) {
    const proposal = await think(prompt, {});
    if (!proposal?.title) {
      console.error(`\n  ${icon(false)} ${RED}think failed — no proposal created${RESET}`);
      return 1;
    }
    changeId = proposal.title;
    process.stderr.write(`${icon(true)} ${BOLD}STEP 1/6${RESET}: THINK     ${DIM}${changeId}${RESET}  ${elapsed(t1)}\n`);
  }

  // ── STEP 2/6: DRAFT ─────────────────────────
  const t2 = process.hrtime.bigint();
  if (isReenter) {
    process.stderr.write(`${icon(true)} ${BOLD}STEP 2/6${RESET}: DRAFT     ${DIM}(skipped — already exists)${RESET}  \n`);
  } else {
    const artifacts = await draft(changeId, { noCache: false, lang: 'ru' });
    if (!artifacts) {
      console.error(`\n  ${icon(false)} ${RED}draft failed for "${changeId}"${RESET}`);
      return 1;
    }
    const specCount = Array.isArray(artifacts.specs) ? artifacts.specs.length : 0;
    process.stderr.write(`${icon(true)} ${BOLD}STEP 2/6${RESET}: DRAFT     ${DIM}${specCount} spec(s), ${artifacts.tasks ?? '?'} task(s)${RESET}  ${elapsed(t2)}\n`);
  }

  // ── STEP 3/6: CLARIFY ───────────────────────
  const t3 = process.hrtime.bigint();
  const questions = generateQuestions(changeId);
  const unresolved = questions.filter(q => !q.resolved);

  if (unresolved.length === 0) {
    if (hasUnansweredBlockers(changeId)) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${RED}unanswered blockers remain${RESET}\n`);
      console.error(`\n  ${ARROW}  Run: orion answer ${changeId} <answers.json>`);
      return 1;
    }
    process.stderr.write(`${icon(true)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${DIM}all clear — no questions${RESET}  ${elapsed(t3)}\n`);
  } else {
    const blockers = unresolved.filter(q => q.priority === 'blocker');
    const clarifying = unresolved.filter(q => q.priority === 'clarifying');

    if (blockers.length > 0) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${RED}${blockers.length} blocker(s) require human input${RESET}  ${elapsed(t3)}\n`);
      for (const q of blockers) {
        console.error(`  ${RED}\u26A0${RESET} ${q.text.slice(0, 80)}`);
      }
      console.error(`\n  ${ARROW}  Answer: orion answer ${changeId} <answers.json>`);
      console.error(`  ${ARROW}  Retry:  orion chat "${prompt}"`);
      return 1;
    }

    if (clarifying.length > 0 && !auto) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${YELLOW}${clarifying.length} clarifying question(s)${RESET}  ${elapsed(t3)}\n`);
      for (const q of clarifying) {
        console.error(`  ${YELLOW}?${RESET} ${q.text.slice(0, 80)}`);
      }
      console.error(`\n  ${ARROW}  Answer: orion answer ${changeId} <answers.json>`);
      console.error(`  ${ARROW}  Retry:  orion chat "${prompt}"`);
      return 1;
    }

    // Auto-answer clarifying questions
    if (clarifying.length > 0 && auto) {
      process.stderr.write(`${YELLOW}${BOLD}  \u231B  Auto-answering ${clarifying.length} question(s)...${RESET}\n`);
      const proposal = await readProposalJson(changeId);
      const goal = proposal?.goal ?? '';
      const context = proposal?.context ?? '';

      const answers: Answer[] = [];
      for (const q of clarifying) {
        const text = await askWithFallback(q, goal, context);
        answers.push({ questionId: q.id, text, ts: new Date().toISOString() });
        process.stderr.write(`  ${DIM}${q.id}: ${text.slice(0, 60)}${RESET}\n`);
      }
      applyAnswers(changeId, answers);
      process.stderr.write(`${icon(true)} ${BOLD}STEP 3/6${RESET}: CLARIFY   ${DIM}${answers.length} auto-answered${RESET}  ${elapsed(t3)}\n`);
    }
  }

  if (full) {
    // ── STEP 4/6: FORGE ─────────────────────────
    const t4 = process.hrtime.bigint();
    process.stderr.write(`${YELLOW}\u231B${RESET} ${BOLD}STEP 4/6${RESET}: FORGE     ${DIM}writing code...${RESET}\n`);
    try {
      const summary = await forge(changeId, {
        noCache: false,
        onTask: (row) => {
          const m = row.status === 'done' ? `${GREEN}${CHECK}${RESET}` : row.status === 'skipped' ? `${DIM}${CHECK}${RESET}` : `${DIM}\u25CB${RESET}`;
          process.stderr.write(`  ${m} ${DIM}${row.desc.slice(0, 60)}${RESET}\n`);
        },
      });
      if (summary.ok) {
        process.stderr.write(`${icon(true)} ${BOLD}STEP 4/6${RESET}: FORGE     ${DIM}${summary.done ?? '?'}/${summary.total ?? '?'} tasks done${RESET}  ${elapsed(t4)}\n`);
      } else {
        process.stderr.write(`${icon(false)} ${BOLD}STEP 4/6${RESET}: FORGE     ${RED}failed${RESET}  ${elapsed(t4)}\n`);
        return 1;
      }
    } catch (err) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 4/6${RESET}: FORGE     ${RED}${err instanceof Error ? err.message : 'error'}${RESET}\n`);
      return 1;
    }

    // ── STEP 5/6: SHIELD ────────────────────────
    const t5 = process.hrtime.bigint();
    process.stderr.write(`${YELLOW}\u231B${RESET} ${BOLD}STEP 5/6${RESET}: SHIELD    ${DIM}running lint + tests + tsc...${RESET}\n`);
    try {
      const report = await shield(changeId, { noCache: false });
      const passCount = report.checks.filter(c => c.status === 'PASS').length;
      const failCount = report.checks.filter(c => c.status === 'FAIL').length;
      const status = report.allPass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
      process.stderr.write(`${icon(report.allPass)} ${BOLD}STEP 5/6${RESET}: SHIELD    ${status} ${DIM}${passCount} pass, ${failCount} fail${RESET}  ${elapsed(t5)}\n`);
      if (!report.allPass) {
        for (const c of report.checks.filter(c => c.status !== 'PASS')) {
          process.stderr.write(`  ${RED}\u26A0${RESET} ${c.step}: ${c.detail ?? ''}\n`);
        }
      }
    } catch (err) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 5/6${RESET}: SHIELD    ${RED}${err instanceof Error ? err.message : 'error'}${RESET}\n`);
      return 1;
    }

    // ── STEP 6/6: OUT ───────────────────────────
    const t6 = process.hrtime.bigint();
    try {
      const result = await out(changeId);
      const status = result.allPass ? `${GREEN}SUCCESS${RESET}` : `${YELLOW}INCOMPLETE${RESET}`;
      process.stderr.write(`${icon(result.allPass)} ${BOLD}STEP 6/6${RESET}: OUT       ${status} ${DIM}${result.tasksDone}/${result.tasksTotal} tasks${RESET}  ${elapsed(t6)}\n`);

      // ── RESULT SUMMARY ──────────────────────────
      const totalTime = elapsed(t0);
      rule();
      resultLine('Change', changeId);
      resultLine('Status', result.allPass ? 'SUCCESS' : 'INCOMPLETE', result.allPass ? GREEN : YELLOW);
      resultLine('Tasks', `${result.tasksDone}/${result.tasksTotal} done`);
      resultLine('Guard', result.staleGuard ? 'STALE' : 'checked');
      resultLine('Total time', totalTime, CYAN);
      console.log();

      return result.allPass ? 0 : 1;
    } catch (err) {
      process.stderr.write(`${icon(false)} ${BOLD}STEP 6/6${RESET}: OUT       ${RED}${err instanceof Error ? err.message : 'error'}${RESET}\n`);
      return 1;
    }
  }

  // Without --full: show next steps
  const totalTime = elapsed(t0);
  rule();
  resultLine('Change', changeId);
  resultLine('Pipeline', 'think + draft + clarify', GREEN);
  resultLine('Status', isReenter ? 're-entered' : 'created');
  resultLine('Total time', totalTime, CYAN);
  console.log();
  process.stderr.write(`  ${ARROW}  Continue: orion forge ${changeId}\n`);
  process.stderr.write(`  ${ARROW}  Or full:  orion chat "${prompt}" --full\n`);
  return 0;
}

// ─── Helpers ─────────────────────────────────────────────
async function readProposalJson(changeId: string): Promise<{ goal?: string; context?: string } | null> {
  try {
    const { readFileSync: read, existsSync: exists } = await import('node:fs');
    const path = `changes/${changeId}/proposal.json`;
    if (!exists(path)) return null;
    return JSON.parse(read(path, 'utf8'));
  } catch { return null; }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
}
