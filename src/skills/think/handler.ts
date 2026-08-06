import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { writeJson } from "../../utils/file.js";
import { OrionTrack } from "../../core/track.js";
import type { Proposal } from "../../type.js";

/** One guided question in the `think` flow. */
export interface Question {
  msg: string;
  key: keyof Proposal;
}

/** The guided questions asked by `orion think`. The goal comes from the prompt. */
export const QUESTIONS: Question[] = [
  { msg: "Which platform / environment is the target?", key: "platform" },
  { msg: "Any constraints (perf, size, deps)?", key: "constraints" },
  { msg: "What is the token/time budget?", key: "budget" },
];

/** Ask a single question on stdin, resolving with the trimmed answer. */
export async function askQuestion(msg: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await new Promise<string>((resolve) => {
      rl.question(`? ${msg} `, resolve);
    });
    return answer.trim();
  } finally {
    rl.close();
  }
}

/**
 * `orion think` — turn a high-level prompt into a Proposal object by
 * asking a handful of guided questions. The ask function is injectable
 * so tests can mock stdin.
 */
export async function think(
  prompt: string,
  opts?: { noCache?: boolean },
  ask: (msg: string) => Promise<string> = askQuestion,
): Promise<Proposal> {
  const proposal: Proposal = {
    title: slugify(prompt),
    goal: prompt,
    platform: "",
    constraints: "",
    budget: "",
  };

  for (const q of QUESTIONS) {
    const answer = await ask(q.msg);
    if (answer) proposal[q.key] = answer;
  }

  await writeJson(`changes/${proposal.title}/proposal.json`, proposal);
  if (!opts?.noCache) {
    OrionTrack.init().store(
      `proposal:${proposal.title}`,
      JSON.stringify(proposal),
    );
  }

  return proposal;
}

/** Turn a free-form prompt into a filesystem-safe identifier. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "untitled"
  );
}
