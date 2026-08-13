# Предложение — внедрить-сопоставление-атомарного-шага

## Цель
Внедрить сопоставление атомарного шага со skill-реестром поэтапно, начиная с дешёвого минимума без ML: (Фаза 1) эволюционировать существующий реестр RunManifest — добавить tags, domain, environmentFingerprint; BM25/TF-IDF скоринг по нормализованной строке действия + описанию + тегам (self-contained, без внешних сервисов); консервативный порог без ложных срабатываний; лог промахов с первого дня (какой шаг, что не нашлось, что сделала LLM). (Фаза 2) промоушен в skill по повторам из лога, но ТОЛЬКО с подтверждением человека + прогон на исторических входах/выходах. (Фаза 3) эмбеддинги только если логи покажут системный промах BM25. (Фаза 4) инвалидация skill по отпечатку окружения. Метрика экономии токенов с первого дня. Deliverable: BM25-скоринг + миss-лог + домен-фильтр + подтверждаемый промоушен.

## Контекст

| Аспект | Значение |
|--------|----------|
| Платформа | zero-runtime-deps, reuse existing RunManifest/scriptsDir/runScript/sessions.ts/sandbox, no ML in Phase 1, per-project domain filter before matching, log every miss from day 1, promotion only with human confirm + replay on historical IO, env fingerprint for skills, cost metric from day 1, admin approve |
| Бюджет | compact |
| Ограничения | compact |

- **Lessons applied (v0.12):** скилл-onec-converter-migration:forge:bc925d77a1ff, довести-стратегию-съесть-слона:shield:76ef425afa46, v0-46-устранить-дубли:forge:c0563dbd8439, фаза-40-0-23:forge:609368098be5, фаза-6-внедрить-идеи:shield:a4912ba5105d
