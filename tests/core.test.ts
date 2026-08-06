import { describe, it, expect } from "vitest";
import { core } from "../src/tasks/core.js";

describe("core capability (v0.10)", () => {
  it("declares the honesty & companion core", () => {
    expect(core.name).toBe("core");
    expect(core.version).toBe("0.10");
    expect(core.principles).toContain("honesty");
    expect(core.principles).toContain("companionship");
    expect(core.principles).toContain("process-over-model");
  });
});
