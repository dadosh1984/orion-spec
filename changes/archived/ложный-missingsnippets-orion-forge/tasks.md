# Tasks — ложный-missingsnippets-orion-forge

Исправление ложного missingSnippets: файл сниппета существует, но имя не
совпадает с детерминированным slug (после v0.24 shortSlug). Реализация в
`src/skills/forge/snippet.ts`; handler.ts и worker.ts используют резолвер.

- [x] [fact] Resolve snippet files: exact match, then unique legacy/prefix/token-overlap fallback, else null + candidates — src/skills/forge/snippet.ts
- [x] [fact] Wire resolver into forge handlers: default provider and worker use resolveSnippet; missingSnippets lists existing files — src/skills/forge/handler.ts, worker.ts
- [x] [fact] Capability manifest forge_snippet exports the capability for the spec — src/tasks/forge_snippet.ts
- [x] [assumption] Cover resolver with tests: exact wins, legacy name found, ambiguous → null + candidates, none → null + file list — tests/forge-snippet.test.ts
