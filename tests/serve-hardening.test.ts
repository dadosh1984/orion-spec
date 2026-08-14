import { describe, it, expect, afterEach } from "vitest";
import { redactDeep, rateLimitAllowed } from "../src/cli/serve.js";
import type { IncomingMessage } from "node:http";

const ORIG_LIMIT = process.env.ORION_SERVE_RATE_LIMIT;

afterEach(() => {
  delete process.env.ORION_SERVE_RATE_LIMIT;
  if (ORIG_LIMIT !== undefined) process.env.ORION_SERVE_RATE_LIMIT = ORIG_LIMIT;
});

function reqFrom(addr: string): IncomingMessage {
  // A minimal IncomingMessage-shaped stub exposing only socket.remoteAddress.
  return { socket: { remoteAddress: addr } } as unknown as IncomingMessage;
}

describe("serve hardening — 3.11 redaction + 3.10 rate-limit", () => {
  it("3.11 redactDeep redacts credential-shaped strings anywhere in the tree", () => {
    const out = redactDeep({
      ok: true,
      cache: [{ key: "git log", value: "token: sk_secret_abc123" }],
      env: "DB_PASSWORD=sup3rsecret",
      safe: "just normal output",
    }) as Record<string, unknown>;
    expect(String(out.cache[0].value)).toContain("[redacted");
    expect(String(out.env)).toContain("[redacted");
    expect(out.safe).toBe("just normal output");
  });

  it("3.11 redactDeep leaves a credential-free tree untouched", () => {
    const tree = { ok: true, value: "hello world", n: 42, tags: ["a"] };
    expect(redactDeep(tree)).toEqual(tree);
  });

  it("3.10 rate-limit enforces the cap per address (default 60, capped to 2 here)", () => {
    process.env.ORION_SERVE_RATE_LIMIT = "2";
    const req = reqFrom("127.0.0.1");
    expect(rateLimitAllowed(req)).toBe(true);
    expect(rateLimitAllowed(req)).toBe(true);
    expect(rateLimitAllowed(req)).toBe(false); // third in window → limited
  });

  it("3.10 rate-limit 0 disables the check", () => {
    process.env.ORION_SERVE_RATE_LIMIT = "0";
    expect(rateLimitAllowed(reqFrom("127.0.0.1"))).toBe(true);
    expect(rateLimitAllowed(reqFrom("127.0.0.1"))).toBe(true);
  });
});
