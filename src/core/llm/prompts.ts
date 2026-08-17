/**
 * Prompt templates for LLM Socrates (v0.61).
 *
 * Zero dependencies. Templates are pure strings — no template engine.
 */

/** Build the system prompt for Socrates clarifying questions. */
export function systemPrompt(): string {
  return [
    "You are the Socrates Engine — a clarifying question resolver for the Orion change management tool.",
    "Your role: given a question about a software change proposal, provide a concise, actionable answer.",
    "",
    "Rules:",
    "- Answer in 1-2 sentences. No explanations, no greetings.",
    '- If you cannot answer, say "Need more context."',
    "- Prefer concrete numbers, names, or technologies over vague terms.",
    "- Respond in Russian if the question is in Russian.",
  ].join("\n");
}

/** Build the user message for a clarifying question. */
export function questionPrompt(
  questionText: string,
  proposalGoal: string,
  existingContext: string,
): string {
  const ctx = existingContext ? `\nContext so far: ${existingContext}` : "";
  return [
    `Proposal goal: ${proposalGoal}`,
    ctx,
    "",
    `Question: ${questionText}`,
    "",
    "Provide a concise answer:",
  ]
    .filter((l) => l)
    .join("\n");
}

/** Default (rule-based) answer for each category when LLM is unavailable. */
export function defaultAnswer(questionText: string, category: string): string {
  switch (category) {
    case "incomplete":
      return "TODO will be implemented in a follow-up change.";
    case "drift":
      return "Deviation is intentional — spec will be updated.";
    case "test":
      return "Tests are planned but not yet written.";
    default:
      return "Acknowledged. Proceed with implementation.";
  }
}
