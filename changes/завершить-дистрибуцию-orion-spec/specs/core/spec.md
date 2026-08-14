# Spec: packageSurface

Закрыть npm-дистрибуцию orion-spec: published tarball чист от
self-dependency и `npm install -g` ставит 0.52.0 с рабочим Honest
Receipt. Практическое доказательство (pack + npm view), а не декларация.

## Scope
- In scope: экзекейбленный tarball (dependencies без `link:`), package.json
  /pnpm-lock, release workflow, README-бейдж версии.
- Out of scope: runtime-логика ядра (не трогаем skills/match/out), миграция
  cache-схемы, новые фичи.
