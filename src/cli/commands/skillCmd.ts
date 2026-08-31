import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { statusMark, paint } from "../../utils/term.js";

/**
 * `orion skill` — search and install community skills (v0.68+).
 */
export async function skillHandler(args: string[]): Promise<number> {
  const sub = args[0];
  const name = args[1];

  if (!sub) return skillList();

  if (sub === "--help" || sub === "-h") {
    console.log(
      [
        `${paint("orion skill", "cyan")} — search and install community skills`,
        "",
        "  orion skill                        List installed skills",
        "  orion skill search <query>         Search GitHub for skills",
        "  orion skill install <owner/repo>   Install a skill from GitHub",
        "",
        "Examples:",
        "  orion skill search validate",
        "  orion skill install dadosh1984/orion-skill-e164-validator",
      ].join("\n"),
    );
    return 0;
  }

  switch (sub) {
    case "search": {
      if (!name) return fail("skill search requires a query");
      return skillSearch(name);
    }
    case "install": {
      if (!name) return fail("skill install requires <owner/repo>");
      return skillInstall(name);
    }
    default: {
      // Treat sub as a skill name to run? No, that's for `orion run`.
      // For skill, we only have search and install.
      return fail(
        `unknown subcommand "${sub}".\n  Usage: orion skill [search|install]`,
      );
    }
  }
}

function skillList(): number {
  const scriptsDir = join(homedir(), ".orion", "scripts");
  if (!existsSync(scriptsDir)) {
    console.log(
      `${statusMark("info")} No skills installed yet.\n  Install: orion skill install <owner/repo>`,
    );
    return 0;
  }
  const dirs = readdirSync(scriptsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (dirs.length === 0) {
    console.log(
      `${statusMark("info")} No skills installed yet.\n  Install: orion skill install <owner/repo>`,
    );
    return 0;
  }
  console.log(`${statusMark("info")} Installed skills (${dirs.length}):`);
  for (const dir of dirs) {
    console.log(`  ${dir}`);
  }
  return 0;
}

async function skillSearch(query: string): Promise<number> {
  console.log(
    `${statusMark("info")} Searching GitHub for skills related to "${query}"...`,
  );
  try {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", `topic:orion-skill ${query}`);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "10");

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
        // Optional: add authentication for higher rate limit
        // Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const repos = data.items;

    if (repos.length === 0) {
      console.log(`${statusMark("info")} No skills found for "${query}".`);
      return 0;
    }

    console.log(`${statusMark("done")} Found ${repos.length} skill(s):`);
    for (const repo of repos) {
      console.log(
        `  ${paint(repo.full_name, "cyan")} — ${repo.description ?? "No description"}`,
      );
      console.log(
        `    Stars: ${repo.stargazers_count} | Language: ${repo.language ?? "unknown"}`,
      );
      console.log(`    URL: ${repo.html_url}`);
      console.log("");
    }
    return 0;
  } catch (err) {
    console.error(
      `${statusMark("error")} Failed to search skills: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

async function skillInstall(ownerRepo: string): Promise<number> {
  const [owner, repo] = ownerRepo.split("/");
  if (!owner || !repo) {
    return fail('Invalid format. Use "owner/repo"');
  }

  console.log(`${statusMark("info")} Installing skill "${ownerRepo}"...`);

  try {
    // Fetch repository info to get the default branch and download URL
    const repoUrl = new URL(`https://api.github.com/repos/${owner}/${repo}`);
    const repoResponse = await fetch(repoUrl.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || "main";

    // Download the repository as a zipball
    const zipUrl = new URL(
      `https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`,
    );
    const zipResponse = await fetch(zipUrl.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!zipResponse.ok) {
      throw new Error(`Failed to download repository: ${zipResponse.status}`);
    }

    // We need to extract the zipball. Since we don't have a built-in unzip, we'll use a temporary directory
    // and write the zip file, then extract it using a child process? But we want to avoid dependencies.
    // Alternatively, we can use the GitHub API to get the contents of the repository and download files individually.
    // For simplicity, we'll assume the skill is a single file at the root (like entry.js) and we can download it via the contents API.

    // Let's change approach: get the repository contents and look for a script file.
    const contentsUrl = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents`,
    );
    const contentsResponse = await fetch(contentsUrl.toString(), {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!contentsResponse.ok) {
      throw new Error(
        `Failed to fetch repository contents: ${contentsResponse.status}`,
      );
    }

    const contents = await contentsResponse.json();

    // We are looking for a script file: run.js, run.sh, run.py, or entry.js, entry.sh, entry.py
    const scriptExtensions = [".js", ".sh", ".py"];
    const scriptPrefixes = ["run", "entry"];

    let scriptFile: string | null = null;
    let scriptContent: string | null = null;
    let manifest: any = null;

    // First, look for orion.json manifest
    const manifestItem = contents.find(
      (item: any) => item.name === "orion.json" && item.type === "file",
    );
    if (manifestItem) {
      const manifestResponse = await fetch(manifestItem.download_url);
      if (manifestResponse.ok) {
        manifest = await manifestResponse.json();
      }
    }

    // Look for a script file
    for (const item of contents) {
      if (item.type !== "file") continue;
      const lowerName = item.name.toLowerCase();
      for (const prefix of scriptPrefixes) {
        for (const ext of scriptExtensions) {
          if (lowerName === `${prefix}${ext}`) {
            scriptFile = item.name;
            const scriptResponse = await fetch(item.download_url);
            if (scriptResponse.ok) {
              scriptContent = await scriptResponse.text();
            }
            break;
          }
        }
        if (scriptFile) break;
      }
      if (scriptFile) break;
    }

    if (!scriptFile || !scriptContent) {
      // Fallback: look for any .js, .sh, .py file and use the first one as the script
      for (const item of contents) {
        if (item.type !== "file") continue;
        const ext = item.name.slice(item.name.lastIndexOf("."));
        if ([".js", ".sh", ".py"].includes(ext)) {
          scriptFile = item.name;
          const scriptResponse = await fetch(item.download_url);
          if (scriptResponse.ok) {
            scriptContent = await scriptResponse.text();
          }
          break;
        }
      }
    }

    if (!scriptFile || !scriptContent) {
      return fail(
        `No script file found in the repository. Expected a file like run.js, run.sh, run.py, entry.js, etc.`,
      );
    }

    // Determine the skill name (use the repo name)
    const skillName = repo;

    // Prepare the skill directory
    const scriptsDir = join(homedir(), ".orion", "scripts");
    const skillDir = join(scriptsDir, skillName);
    if (existsSync(skillDir)) {
      // Remove existing skill directory
      const { rmSync } = await import("node:fs");
      rmSync(skillDir, { recursive: true, force: true });
    }
    mkdirSync(skillDir, { recursive: true });

    // Determine the script extension and write the script file
    const ext = scriptFile.slice(scriptFile.lastIndexOf("."));
    let runtime: "bash" | "node" | "python";
    if (ext === ".js") runtime = "node";
    else if (ext === ".py") runtime = "python";
    else if (ext === ".sh") runtime = "bash";
    else {
      // Default to node if unknown
      runtime = "node";
    }

    const scriptPath = join(skillDir, `run${ext}`);
    writeFileSync(scriptPath, scriptContent, "utf8");

    // Make executable on Unix for .sh files
    if (ext === ".sh") {
      try {
        const { chmodSync } = await import("node:fs");
        chmodSync(scriptPath, 0o755);
      } catch {
        /* Windows — ok */
      }
    }

    // Write orion.json manifest if not provided
    if (!manifest) {
      manifest = {
        name: skillName,
        description: `Installed from GitHub: ${ownerRepo}`,
        runtime,
        created: new Date().toISOString(),
        lastRun: null,
        runCount: 0,
        schedule: null,
        tags: [],
        domain: "general", // default domain
      };
    } else {
      // Ensure required fields are present
      manifest.name = manifest.name || skillName;
      manifest.runtime = manifest.runtime || runtime;
      manifest.created = manifest.created || new Date().toISOString();
      manifest.lastRun = manifest.lastRun ?? null;
      manifest.runCount = manifest.runCount ?? 0;
    }

    // Write manifest
    const manifestPath = join(skillDir, "orion.json");
    writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );

    console.log(
      `${statusMark("done")} Skill "${skillName}" installed successfully.`,
    );
    console.log(`  Location: ${skillDir}`);
    console.log(`  Script:   run${ext}`);
    console.log(`  Runtime:  ${runtime}`);
    console.log(`  To run:   orion run ${skillName}`);

    return 0;
  } catch (err) {
    console.error(
      `${statusMark("error")} Failed to install skill: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

function fail(msg: string): number {
  console.error(`orion: ${statusMark("error")} ${msg}`);
  return 1;
}
