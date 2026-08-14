/**
 * denyEnv (v0.53, task 3.13) — keep secrets out of child-process env.
 *
 * A script run via `orion run` inherits the whole `process.env`; a secret
 * like `GITHUB_TOKEN` would leak into external code (which may echo it to
 * output/cache). This filters secret-shaped variable NAMES out of the env
 * we hand to a child script. The parent (orion itself) keeps its env intact.
 */

/** Deny patterns — any var whose name matches is stripped from child env. */
const DENY =
  /(^|_)(TOKEN|SECRET|KEY|PASSWD|PASSWORD|PRIVATE_?KEY|API_?KEY)(_|$)|^(AWS_|GITHUB_|GH_|ORION_API_?KEY|DATABASE_URL|MONGO_|REDIS_|PG_)/i;

/** A variable name that must not reach a child process. */
export function isDeniedEnvName(name: string): boolean {
  return DENY.test(name);
}

/**
 * Build a child env: `env` minus denied secret names. Keys are already
 * normalized (node env keys are upper-case in practice, but we match case-
 * insensitively). Returns a plain object.
 */
export function denyEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (Object.prototype.hasOwnProperty.call(env, k) && !isDeniedEnvName(k)) {
      // keep only string-ish values node passes through
      if (typeof v === "string" || typeof v === "number") out[k] = String(v);
    }
  }
  return out;
}
