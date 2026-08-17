/**
 * Optional browser engine for `orion run` (v0.50).
 *
 * When ORION_SANDBOX=browser, runScript loads the script and executes it in a
 * real Chromium via a DYNAMIC import of `playwright`. This keeps the project
 * zero-dependency by default: playwright is only required at the moment a
 * script actually opts into browser execution, and only on the user's machine
 * that runs it.
 *
 * Contract: a browser-mode script exports an async function `run(ctx)` where
 * ctx = { page, browser, fetch, url, args }. It should return a JSON-serializable
 * result; the runner prints it as { status, summary, ... }.
 *
 * If the script is a plain fetch-style script (default `run.js`), we still
 * provide `page` and let it call page.goto(), after which we return the final
 * page content so existing HTML parsers keep working unchanged.
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunManifest } from "./runtime.js";

/**
 * Load a user browser skill as an ESM module regardless of where it lives.
 * A plain `run.js` inside ~/.orion/scripts has no package.json with "type":
 * "module", so Node would parse it as CommonJS and `export` fails. We copy it
 * to a temp `.mjs` file (ESM by extension) and import from there.
 */
async function importSkillAsEsm(scriptFile: string): Promise<any> {
  const { pathToFileURL } = await import("node:url");
  const src = readFileSync(scriptFile, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "orion-browser-"));
  const tmp = join(dir, "skill.mjs");
  writeFileSync(tmp, src, "utf8");
  try {
    return await import(pathToFileURL(tmp).href);
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ok */
    }
  }
}

export interface BrowserRunResult {
  ok: boolean;
  output: string;
  durationMs: number;
}

export async function runInBrowser(
  name: string,
  scriptFile: string,
  m: RunManifest,
  args: string[],
): Promise<BrowserRunResult> {
  let chromium: any;
  try {
    // playwright is an OPTIONAL peer dependency — never bundled with the
    // project. When it is installed, types resolve; when it is not, this
    // import still resolves to `any` at runtime via a natural catch.
    const mod = await import("playwright");
    chromium = mod.chromium;
  } catch {
    return {
      ok: false,
      output:
        "Browser engine requested (ORION_SANDBOX=browser) but 'playwright' is " +
        "not installed. Install it once:  npm i -D playwright && npx playwright install chromium",
      durationMs: 0,
    };
  }

  const start = Date.now();
  let browser: any;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    });
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    });

    // Build a ctx object available to browser-minded scripts.
    const ctx = {
      page,
      browser,
      url: process.env.BROWSER_URL ?? "",
      args,
      // Provide node fetch inside the script context too.
      fetch: globalThis.fetch,
    };

    // Load the user's script as a plain module. It may export run(ctx) or
    // simply do its own work and assign result to a global.
    let userRun: ((c: typeof ctx) => Promise<unknown> | unknown) | undefined;
    try {
      // Copy to temp .mjs so skill.js parses as ESM outside the project.
      const mod = await importSkillAsEsm(scriptFile);
      if (typeof mod.run === "function") userRun = mod.run;
    } catch {
      /* not an ES module / no export — see below */
    }

    if (userRun) {
      const result = await userRun(ctx);
      const out =
        typeof result === "string"
          ? result
          : JSON.stringify(
              {
                status: "success",
                summary:
                  typeof result === "object" &&
                  result &&
                  "summary" in (result as object)
                    ? (result as any).summary
                    : `${name} completed`,
                ...(result && typeof result === "object" ? result : {}),
              },
              null,
              2,
            );
      return { ok: true, output: out, durationMs: Date.now() - start };
    }

    // Plain script mode: fetch the target and return rendered HTML so the
    // script's own parser (the same regex-based one) can run on real DOM.
    const target = process.env.BROWSER_URL;
    if (!target) {
      return {
        ok: false,
        output: "Browser script has no run() and BROWSER_URL is not set.",
        durationMs: Date.now() - start,
      };
    }
    await page.goto(target, { waitUntil: "networkidle", timeout: 30000 });
    const html = await page.content();
    return { ok: true, output: html, durationMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      output: `Browser run failed: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - start,
    };
  } finally {
    if (browser && typeof browser.close === "function") {
      try {
        await browser.close();
      } catch {
        /* ok */
      }
    }
  }
}
