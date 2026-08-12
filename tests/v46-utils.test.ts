import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isLoopbackHost } from "../src/utils/net.js";
import { generateToken } from "../src/utils/crypto.js";
import { redactValue } from "../src/utils/redact.js";
import { fail } from "../src/utils/term.js";
import {
  collectTsFiles,
} from "../src/utils/file.js";
import { humanBytes } from "../src/utils/format.js";
import {
  MAX_BUDGET,
  ORION_HOME,
  ORION_SPEND_FILE,
  ORION_PROFILE_FILE,
  ORION_CACHE_DIR,
  ORION_LESSONS_FILE,
} from "../src/constants.js";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("collectTsFiles", () => {
  const tmp = join(tmpdir(), "orion-v46-test-" + Date.now());

  beforeAll(() => {
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(join(tmp, "src", "sub"), { recursive: true });
    mkdirSync(join(tmp, "node_modules"), { recursive: true });
    writeFileSync(join(tmp, "src", "a.ts"), "// a");
    writeFileSync(join(tmp, "src", "b.tsx"), "// b");
    writeFileSync(join(tmp, "src", "sub", "c.ts"), "// c");
    writeFileSync(join(tmp, "node_modules", "d.ts"), "// d");
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("collects .ts files by default", () => {
    const files = collectTsFiles(join(tmp, "src"));
    expect(files.length).toBe(2);
    expect(files.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("c.ts"))).toBe(true);
  });

  it("skips node_modules by default", () => {
    const files = collectTsFiles(tmp);
    expect(files.some((f) => f.includes("node_modules"))).toBe(false);
  });

  it("supports tsx option", () => {
    const files = collectTsFiles(join(tmp, "src"), { tsx: true });
    expect(files.some((f) => f.endsWith("b.tsx"))).toBe(true);
  });

  it("respects depth limit", () => {
    const files = collectTsFiles(tmp, { depth: 1 });
    expect(files.some((f) => f.includes("sub"))).toBe(false);
  });
});

describe("humanBytes", () => {
  it("formats bytes", () => {
    expect(humanBytes(0)).toBe("0 B");
    expect(humanBytes(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(humanBytes(1024)).toBe("1.0 KB");
    expect(humanBytes(1536)).toBe("1.5 KB");
  });
  it("formats MB", () => {
    expect(humanBytes(1048576)).toBe("1.0 MB");
  });
});

describe("isLoopbackHost", () => {
  it("detects loopback", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });
  it("rejects external", () => {
    expect(isLoopbackHost("192.168.1.1")).toBe(false);
    expect(isLoopbackHost("example.com")).toBe(false);
  });
});

describe("generateToken", () => {
  it("generates unique 32-char tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(a).not.toBe(b);
  });
  it("is url-safe base64", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("redactValue", () => {
  it("passes non-strings through", () => {
    expect(redactValue(123)).toBe(123);
    expect(redactValue(null)).toBe(null);
  });
  it("passes clean strings through", () => {
    expect(redactValue("hello world")).toBe("hello world");
  });
  it("redacts secret-looking strings", () => {
    const r = redactValue("api_key=abc1234567890") as string;
    expect(r).toContain("[redacted");
  });
});

describe("fail", () => {
  it("calls process.exit with code", () => {
    const orig = process.exit;
    let exited: number | undefined;
    // @ts-expect-error mock
    process.exit = (c?: number) => {
      exited = c;
      throw new Error("exit");
    };
    try {
      fail("test error", 2);
    } catch {
      // expected
    }
    process.exit = orig;
    expect(exited).toBe(2);
  });
});

describe("constants", () => {
  it("MAX_BUDGET is defined", () => {
    expect(MAX_BUDGET).toBeGreaterThan(0);
  });
  it("ORION_HOME ends with .orion", () => {
    expect(ORION_HOME.endsWith(".orion")).toBe(true);
  });
  it("paths are under ORION_HOME", () => {
    expect(ORION_SPEND_FILE.startsWith(ORION_HOME)).toBe(true);
    expect(ORION_PROFILE_FILE.startsWith(ORION_HOME)).toBe(true);
    expect(ORION_CACHE_DIR.startsWith(ORION_HOME)).toBe(true);
    expect(ORION_LESSONS_FILE.startsWith(ORION_HOME)).toBe(true);
  });
});
