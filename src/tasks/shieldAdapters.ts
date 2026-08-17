// Re-export for drift check — these are the public API symbols for shield adapters
export {
  ShieldAdapter,
  GuardCommand,
  registerAdapter,
  getAdapters,
  detectAdapter,
  clearAdapters,
} from "../core/shield/adapter.js";
export { TypeScriptAdapter } from "../core/shield/typescript.js";
export { PythonAdapter } from "../core/shield/python.js";
export { initAdapters, resolveAdapter } from "../skills/shield/handler.js";
