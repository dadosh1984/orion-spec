import { statusMark } from "../utils/term.js";
import { routeRequest, findExistingSkill } from "../core/router.js";

export function routeDispatch(args: string[]): number {
  const prompt = args.join(" ").trim();

  if (args[0] === "search" && args[1]) {
    const found = findExistingSkill(args.slice(1).join(" "));
    if (found) {
      console.log(
        `${statusMark("done")} Found: ${found.name} (score: ${found.score})`,
      );
      console.log(`  Run with: orion run ${found.name}`);
    } else {
      console.log(`${statusMark("info")} No matching skill found.`);
      console.log(`  Create: orion run new <name>`);
    }
    return 0;
  }

  if (!prompt) {
    console.log(
      `${statusMark("info")} Usage: orion route <prompt>  or  orion route search <query>`,
    );
    return 0;
  }

  const decision = routeRequest(prompt);
  console.log(
    [
      `${statusMark("info")} Router decision:`,
      `  Action:     ${decision.action}`,
      decision.skillName ? `  Skill:      ${decision.skillName}` : "",
      `  Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
      `  Reason:     ${decision.reason}`,
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );

  if (decision.action === "USE_EXISTING_SKILL" && decision.skillName) {
    console.log(`\n  Run: orion run ${decision.skillName}`);
  }

  return 0;
}
