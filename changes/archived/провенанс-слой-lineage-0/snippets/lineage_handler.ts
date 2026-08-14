/**
 * GREEN — провенанс-слой lineage (2.5 + 4.5, 0.56.0) — явный, честный.
 *
 * Принцип: «lesson повлиял» <=> пользователь ЯВНО применил. Эвристика в
 * `orion new` — только подсказка, НИКОГДА не запись в borrowedLessons.
 *
 * 2.5 src/core/lineage.ts applyLesson(changeId, lessonId, note?):
 *   - требует существующий lesson (phantom → честный отказ);
 *   - идемпотентен (одна запись на lesson);
 *   - пишет proposal.json.borrowedLessons[{lessonId, appliedAt, note?}].
 *   CLI: `orion memory lessons apply <id> --to <change> [--note ...]`.
 *
 * 4.5 lineageOf(lessonId): BFS по ЯВНЫМ ссылкам — backward lessonSourceChange
 *   (born-from), forward appliedTo (borrowedLessons) + lessonsBornFrom;
 *   cycle-safe (visitedSets), orphan «(not recorded — manual lesson)»,
 *   applied-none «(none yet)»; детерминизм. CLI: `orion lineage <lesson-id>`
 *   (ASCII / --json). Хендлер не выдумывает — читает sourceChange и
 *   borrowedLessons, нет → честный статус.
 *
 * Lesson.sourceChange? / Proposal.borrowedLessons (type.ts).
 * Тесты tests/lineage.test.ts (9): apply/exists/idempotent/phantom (2.5),
 * chain 3, cycle, orphan, none, determinism (4.5).
 * Гейт 85 файлов / 864 теста, shield allPass. Content для 0.56.0.
 */
