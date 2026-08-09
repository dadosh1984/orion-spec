/**
 * Task 5 — profile CLI view (drift-gate manifest for `# Spec: node`).
 * Backs the `orion profile` command: renders the profile file as readable
 * markdown, or an honest hint when no profile exists yet.
 */
import { existsSync, readFileSync } from "node:fs";
import { profilePath } from "../core/profile.js";

/** Render the profile for the terminal. */
export function profileView(): string {
  const path = profilePath();
  try {
    if (!existsSync(path)) {
      return (
        `No profile yet at ${path}.\n` +
        `It is created automatically by the first \`orion think\` and remembered across projects.`
      );
    }
    return readFileSync(path, "utf8");
  } catch {
    return `Could not read the profile at ${path}.`;
  }
}

/** Smoke entry for the forge-generated test: first line of the view. */
export const profile_cli_view = (): string => profileView().split("\n")[0];
