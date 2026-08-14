/**
 * GREEN — 3.13 denyEnv: секреты не уходят в child-скрипт.
 *
 * src/core/denyEnv.ts: isDeniedEnvName (паттерны *TOKEN *SECRET *KEY *PASSWORD
 * AWS_* GITHUB_* и др.) + denyEnv(env) — фильтр из process.env перед передачей
 * env в дочерний скрипт (runtime.ts run-скрипт). Секреты не попадают в
 * внешний код/output/cache. Сам orion держит свой env без изменений;
 * отклоняется только child-env.
 */
