/** Task 2 manifest (forge RED-GREEN). Wiring lives in handler.ts + worker.ts. */
import { resolveSnippet } from "../skills/forge/snippet.js";

export const wire_resolver_forge = (): typeof resolveSnippet => resolveSnippet;
