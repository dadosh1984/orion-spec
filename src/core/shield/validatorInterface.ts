export interface ShieldContext {
  changeId: string;
  cwd: string;
  strict?: boolean;
}

export interface ValidationCheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  detail?: string;
  durationMs: number;
}

export interface ShieldPlugin {
  name: string;
  phase: "lint" | "typecheck" | "test" | "drift" | "security" | "custom";
  run: (ctx: ShieldContext) => Promise<ValidationCheckResult>;
}
