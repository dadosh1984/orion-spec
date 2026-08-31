import type { CommandHandler } from "../registry.js";
import { main as safeEnvMain } from "../safe-env.js";

export const safeEnvHandler: CommandHandler = async (args) => safeEnvMain(args);
