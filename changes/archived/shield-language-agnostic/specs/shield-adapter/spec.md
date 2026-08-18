# Spec: ShieldAdapter

Интерфейс для language-agnostic guardrails. Каждый адаптер предоставляет команды и парсеры для своего языка.

```typescript
export interface GuardCommand {
  cmd: string;
  args: string[];
  /** Парсер stdout → status/detail. По умолчанию exit code. */
  parser?: (stdout: string) => { status: "PASS" | "FAIL"; detail: string };
}

export interface ShieldAdapter {
  id: string;
  /** Определение языка по маркерам проекта */
  detect(cwd: string): boolean;
  /** Команды для guardrails */
  getLintCommand(): GuardCommand | null;
  getTypeCheckCommand(): GuardCommand | null;
  getTestCommand(): GuardCommand | null;
  /** Извлечение публичного API для drift check */
  extractApi(files: string[]): string[];
  /** Паттерны безопасности для данного языка */
  getSecurityPatterns(): { re: RegExp; label: string }[];
  /** Функция YAGNI: медиана LOC/imports для файлов языка */
  fileMetrics(file: string): { loc: number; imports: number };
}
```

# Spec: TypeScriptAdapter

Перенос существующей логики из `src/skills/shield/handler.ts` в адаптер без изменения поведения.

- `detect()`: проверяет наличие `package.json`
- `getLintCommand()`: `stepCommand("lint")` — текущая логика
- `getTypeCheckCommand()`: `stepCommand("type")` — текущая логика
- `getTestCommand()`: `stepCommand("test")` — текущая логика
- `extractApi()`: парсит export declarations — текущая `collectExports()`
- `getSecurityPatterns()`: текущие `HAZARDS_JS` + security scan patterns
- `fileMetrics()`: LOC + import count — текущая `yagniFindings()`

# Spec: PythonAdapter

- `detect()`: проверяет `pyproject.toml`, `setup.py`, `setup.cfg`, `.python-version`
- `getLintCommand()`: `ruff check . --output-format json`
- `getTypeCheckCommand()`: `mypy . --no-error-summary`
- `getTestCommand()`: `pytest -q --tb=short`
- `extractApi()`: запускает `python3 scripts/extract_python_api.py`
- `getSecurityPatterns()`: eval, exec, subprocess(shell=True), os.system, pickle.loads, ctypes
- `fileMetrics()`: LOC + import count (импорты через `import|from` regex)

# Spec: initAdapters

Инициализация адаптеров и авто-детект языка. Функции в `src/skills/shield/handler.ts`:
1. Пытается найти `orionShield.json` в корне проекта
2. Если нет — автодетектит язык через адаптеры (TypeScriptAdapter пробуется первым для обратной совместимости)
3. `stepCommand` больше не хардкодит TS — делегирует адаптеру
4. `driftCheck` вызывает `adapter.extractApi()`
5. `securityScan` использует `adapter.getSecurityPatterns()`
6. `yagniCheck` вызывает `adapter.fileMetrics()`
