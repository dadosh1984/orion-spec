// ESLint 9 flat config for the Orion monorepo.
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import noShellSync from "./tools/eslint-rules/no-shell-sync.js";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "reports/**",
      "changes/**",
    ],
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: { local: { rules: { "no-shell-sync": noShellSync } } },
    files: ["src/**/*.ts"],
    rules: { "local/no-shell-sync": "error" },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
