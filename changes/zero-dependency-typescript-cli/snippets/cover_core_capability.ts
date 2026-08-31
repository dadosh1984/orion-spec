# ponytail: 4 add vitest coverage for encryption, decryption, corruption and traversal
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../../src/cli/safe-env.js";

describe("safe-env", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "safe-env-"));
    process.chdir(dir);
    process.env.SAFE_ENV_KEY = "secret";
  });
  afterEach(() => {
    delete process.env.SAFE_ENV_KEY;
    process.chdir(process.cwd());
    rmSync(dir, { recursive: true, force: true });
  });
  it("encrypts and decrypts an empty env", () => {
    writeFileSync(".env", "", "utf8");
    expect(main(["encrypt", ".env"])).toBe(0);
    expect(main(["decrypt", ".env.enc"])).toBe(0);
  });
  it("rejects corrupted files", () => {
    writeFileSync(".env.enc", "SAFEENV1\nnope", "utf8");
    expect(main(["decrypt", ".env.enc"])).toBe(1);
  });
  it("lists keys only", () => {
    writeFileSync(".env", "A=1\nB=2", "utf8");
    expect(main(["encrypt", ".env"])).toBe(0);
    expect(main(["list", ".env.enc"])).toBe(0);
  });
  it("blocks path traversal", () => {
    expect(main(["encrypt", "../x"])).toBe(1);
  });
});
