import { shortTitle, slugify } from "../skills/think/handler.js";
import { guardPrompt } from "../skills/think/guard.js";
import { detectLanguage } from "../skills/think/refine.js";
import { deriveTasks } from "../skills/draft/handler.js";
import { statusMark } from "../utils/term.js";

/**
 * `orion plan <prompt>` (v0.33) — dry-run of what `think → draft` would
 * create, WITHOUT writing any file. Deterministic and zero-LLM: it runs
 * the prompt guard (so a dangerous/denied prompt is caught here too),
 * detects the language, derives a title, and enumerates the tasks the
 * change would define. Interactive: prints a readable human plan.
 */
export function planCmd(prompt: string): {
  ok: boolean;
  text: string;
  issues: string[];
} {
  const guard = guardPrompt(prompt);
  if (!guard.ok) {
    return {
      ok: false,
      text: [
        `${statusMark("error")} Prompt drift guard:`,
        ...guard.issues.map((i) => `  - ${i}`),
        "",
        "Refine the prompt before planning, or use `think --force` if you really mean it.",
      ].join("\n"),
      issues: guard.issues,
    };
  }
  const lang = detectLanguage(prompt);
  const title = shortTitle(prompt);
  const slug = slugify(title);
  const tasks = deriveTasks({
    title: slug,
    goal: prompt,
    platform: "node",
    constraints: "",
    budget: "",
  });
  const lines = [
    `${statusMark("info")} Plan for: ${title}`,
    `  Change id:  ${slug}`,
    `  Language:   ${lang}`,
    `  Guard:      clean`,
    "",
    "Pipeline: think → draft → forge → shield → out",
    "",
    "Derived tasks (" + tasks.length + "):",
    ...tasks.map((t) => `  • ${t.text}`),
    "",
    "No files written — run `orion think` then `orion draft` to start.",
  ];
  return { ok: true, text: lines.join("\n"), issues: [] };
}
