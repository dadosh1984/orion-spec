export interface OrionConfig {
  domain?: string;
  runTimeoutMs?: number;
  sandbox?: "basic" | "docker" | "browser";
  preferredRuntime?: "node" | "bash" | "python";
}

export function validateConfig(raw: Record<string, unknown>): {
  ok: boolean;
  errors: string[];
  config: OrionConfig;
} {
  const errors: string[] = [];
  const config: OrionConfig = {};

  if (raw.domain !== undefined) {
    if (typeof raw.domain !== "string") errors.push(".domain must be a string");
    else config.domain = raw.domain;
  }

  if (raw.runTimeoutMs !== undefined) {
    const val = Number(raw.runTimeoutMs);
    if (!Number.isInteger(val) || val <= 0) {
      errors.push(".runTimeoutMs must be a positive integer");
    } else {
      config.runTimeoutMs = val;
    }
  }

  if (raw.sandbox !== undefined) {
    if (!["basic", "docker", "browser"].includes(String(raw.sandbox))) {
      errors.push(".sandbox must be one of: basic, docker, browser");
    } else {
      config.sandbox = raw.sandbox as OrionConfig["sandbox"];
    }
  }

  return { ok: errors.length === 0, errors, config };
}
