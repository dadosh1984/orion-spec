import { describe, it, expect, afterEach } from "vitest";
import { routeRequest, findExistingSkill, verifyRun } from "../src/core/router.js";
import { createScript, deleteScript } from "../src/core/runtime.js";

describe("router", () => {
  const NAME = "_test_router_skill";

  afterEach(() => {
    try { deleteScript(NAME); } catch { /* ok */ }
  });

  it("routes backup task to CREATE_NEW_SKILL", () => {
    const d = routeRequest("сделай бэкап папки Documents");
    expect(d.action).toBe("CREATE_NEW_SKILL");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("routes creative task to DIRECT_AI", () => {
    const d = routeRequest("проанализируй договор и найди риски");
    expect(d.action).toBe("DIRECT_AI");
    expect(d.confidence).toBeGreaterThan(0.5);
  });

  it("finds existing skill by keyword", () => {
    createScript(NAME, "bash", "backup documents folder");
    const found = findExistingSkill("backup documents");
    expect(found).not.toBeNull();
    if (found) expect(found.name).toBe(NAME);
  });

  it("returns null for unknown query", () => {
    const found = findExistingSkill("xyzzy_nonexistent_task_abc");
    expect(found).toBeNull();
  });

  it("routes to USE_EXISTING_SKILL when strong match found", () => {
    createScript(NAME, "bash", "backup documents every day");
    // Need enough keyword matches — use the skill name directly
    const d = routeRequest(NAME + " backup documents");
    expect(d.action).toBe("USE_EXISTING_SKILL");
    expect(d.skillName).toBe(NAME);
  });
});

describe("verifier", () => {
  it("passes valid output with json_field postcondition", () => {
    const out = '{"status":"success","summary":"ok","count":42}';
    const result = verifyRun(out, [
      { type: "json_field", field: "status", equals: "success" },
    ]);
    expect(result.ok).toBe(true);
  });

  it("fails when field does not match", () => {
    const out = '{"status":"error","summary":"fail"}';
    const result = verifyRun(out, [
      { type: "json_field", field: "status", equals: "success" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("passes metric check", () => {
    const out = '{"status":"success","metrics":{"moved":10}}';
    const result = verifyRun(out, [
      { type: "metric", field: "moved", min: 5 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("returns ok=true with no postconditions", () => {
    const result = verifyRun('{"status":"success"}');
    expect(result.ok).toBe(true);
  });
});
