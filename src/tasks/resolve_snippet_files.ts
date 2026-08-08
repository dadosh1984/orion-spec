/** Task 1 manifest (forge RED-GREEN). Real logic: src/skills/forge/snippet.ts. */
import {
  resolveSnippet,
  type SnippetResolution,
} from "../skills/forge/snippet.js";

export { resolveSnippet, type SnippetResolution };

export const resolve_snippet_files = (): typeof resolveSnippet =>
  resolveSnippet;
