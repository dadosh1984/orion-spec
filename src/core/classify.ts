/**
 * Task category classifier (v0.40) — определяет, к какой из 5 категорий
 * skill-first-архитектуры относится задача.
 */

export type TaskCategory = 1 | 2 | 3 | 4 | 5 | 6;

export interface ClassifyResult {
  category: TaskCategory;
  label: string;
  recommendation: "script" | "script_with_ai" | "ai_only" | "reject";
  reason: string;
}

// Category 6 FIRST — dangerous patterns (v0.48)
const CAT6_RE =
  /(rm\s+-rf\s+\/|format\s+(c:|d:|disk)|del\s+\/f\s+\/s\s+\*|shutdown\s+\/s|dd\s+if=|mkfs\.|>\/dev\/sd|>\/dev\/nvme|chmod\s+777\s+\/|sudo\s+rm|удали\s+(?:вс[её]|систем|диск|windows|linux)|форматир(?:уй|овать)\s+(?:диск|disk)|выключ(?:и|ить)\s+(?:комп|сервер|server))/i;

// Category 4 FIRST — "спарсить сайт" before "парсить" (cat 2)
const CAT4_RE =
  /(scrap(?:e|ing)|monitor\s+(?:the\s+)?(?:price|site)|browser|selenium|puppeteer|playwright|спарс(?:ить|инг)|парс(?:ить|инг)\s+(?:сайт|site|web|html)|монитор(?:ить|инг)\s+(?:цен|price|сайт|site)|извле(?:чь|кать)\s+(?:с|из)\s+(?:сайт|site|web)|заполн(?:ить|ение)\s+(?:форм|form)|браузер|(?:найди|ищи|поиск)\s+.{0,60}?на\s+(?:сайте|ebay|e-bay|amazon|site)|найдешь\s+.+\bна\s+(?:сайте|ebay|site))/iu;

const CAT1_RE =
  /(backup|archive|clean(?:up)?|delete\s+(old|dup|temp|junk)|sort\s+(file|folder)|rename|convert|compress|extract\s+archive|run\s+(test|build)|бэкап|архив|очист(?:ить|ка)|удал(?:ить|ение)\s+(?:стар|дубликат|врем|мусор)|сортиров(?:ать|ка)|переимен(?:овать|ование)|конверт(?:ировать|ация)|сжат(?:ь|ие)|распак(?:овать|овка)|запус(?:тить|к)\s+(?:тест|test|сборк|build))/i;

const CAT3_RE =
  /(webhook|telegram|slack|discord|deploy|curl|wget|\bapi\b|fetch\s+(?:rate|data|status)|send\s+(?:a\s+)?(?:message|notification|email|webhook)|отправи(?:ть|ка)\s+(?:сообщен|message|уведом|notification)|полу(?:чить|ение)\s+(?:курс|данные|статус)|запрос\s+(?:к|на)\s+(?:api|сервер)|деплой)/i;

const CAT2_RE =
  /(parse|extract\s+data|valid(?:ate|ation)|парс(?:ить|инг)|извле(?:чь|кать)\s+данные|обработ(?:ать|ка)\s+(?:лог|log|таблиц|table|документ|document)|анализ\s+(?:лог|log|отчёт|report)|провер(?:ить|ка)\s+(?:файл|file|данные|data))/i;

const CAT5_RE =
  /(write\s+(?:text|article|report|email)|research|explain|brainstorm|creative|why|напи(?:ши|сать)\s+(?:текст|стать|письмо|документ|отчёт|report|article|email)|проанализир(?:уй|овать)\s+(?:договор|contract|риск|risk|текст|text|смысл|meaning)|оцен(?:и|ка)\s+(?:риск|risk|иде|idea)|сравн(?:и|ение)|compar(?:e|ison)|план(?:ирование)?\s+(?:проект|project|задач|task)|plan\s+(?:project|task)|исследова(?:ть|ние)|объясн(?:и|ение)|почему|придума(?:й|ть)|креатив)/i;

const RULES: Array<{
  re: RegExp;
  cat: TaskCategory;
  label: string;
  rec: ClassifyResult["recommendation"];
  reason: string;
}> = [
  {
    re: CAT6_RE,
    cat: 6,
    label: "Dangerous / destructive",
    rec: "reject",
    reason:
      "Contains potentially dangerous patterns. Requires explicit user confirmation.",
  },
  {
    re: CAT4_RE,
    cat: 4,
    label: "Dynamic web task",
    rec: "script_with_ai",
    reason:
      "Websites change structure. The script will need periodic AI repair.",
  },
  {
    re: CAT3_RE,
    cat: 3,
    label: "External API / network",
    rec: "script",
    reason: "Uses a stable external API. Can be automated with a script.",
  },
  {
    re: CAT1_RE,
    cat: 1,
    label: "Local deterministic",
    rec: "script",
    reason:
      "Clear, repeatable steps over files. Ideal candidate for a standalone script.",
  },
  {
    re: CAT2_RE,
    cat: 2,
    label: "Local with uncertainty",
    rec: "script_with_ai",
    reason: "Mostly deterministic but may see non-standard input data.",
  },
  {
    re: CAT5_RE,
    cat: 5,
    label: "Creative / analytical",
    rec: "ai_only",
    reason: "Requires context understanding and creative thinking.",
  },
];

export function classifyTask(prompt: string): ClassifyResult {
  const n = prompt.toLowerCase().trim();
  for (const r of RULES) {
    if (r.re.test(n))
      return {
        category: r.cat,
        label: r.label,
        recommendation: r.rec,
        reason: r.reason,
      };
  }
  return {
    category: 5,
    label: "Creative / analytical",
    recommendation: "ai_only",
    reason: "By default — solve via AI.",
  };
}

export function formatClassifyResult(
  r: ClassifyResult,
  _prompt: string,
): string {
  if (r.recommendation === "reject") {
    return [
      "",
      "🚫 This task is «" + r.label + "».",
      r.reason,
      "",
      "Automation rejected. Explicit user confirmation required.",
      "",
    ].join("\n");
  }
  return r.recommendation === "script" || r.recommendation === "script_with_ai"
    ? [
        "",
        "💡 This task looks like «" + r.label + "».",
        r.reason,
        "",
        r.recommendation === "script"
          ? "Recommended: orion forge <change> --save-as <name> — create a standalone script and run it without tokens."
          : "Recommended: orion forge <change> --save-as <name> + orion run <name> for the bulk, AI for exceptions.",
        "",
      ].join("\n")
    : [
        "",
        "🧠 This task is «" + r.label + "».",
        r.reason,
        "",
        "Automation not recommended. Better to solve via AI directly.",
        "",
      ].join("\n");
}
