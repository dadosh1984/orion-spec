import type {
  ShieldPlugin,
  ShieldContext,
  ValidationCheckResult,
} from "./validatorInterface.js";

export class ShieldPluginManager {
  private plugins: ShieldPlugin[] = [];

  register(plugin: ShieldPlugin): void {
    this.plugins.push(plugin);
  }

  getPlugins(): readonly ShieldPlugin[] {
    return this.plugins;
  }

  async runAll(ctx: ShieldContext): Promise<ValidationCheckResult[]> {
    const results: ValidationCheckResult[] = [];
    for (const plugin of this.plugins) {
      const start = Date.now();
      try {
        const res = await plugin.run(ctx);
        results.push(res);
      } catch (err) {
        results.push({
          name: plugin.name,
          status: "FAIL",
          detail: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        });
      }
    }
    return results;
  }
}
