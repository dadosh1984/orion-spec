import { describe, it, expect } from "vitest";
import { installedVersion, updateBanner, updateCheckEnabled } from "../src/core/updateCheck.js";
import { readVersionSafe } from "../src/utils/version.js";
import { main } from "../src/cli/commands.js";

describe("version (v0.36)", () => {
  it("readVersionSafe resolves a real semver from the package", () => {
    expect(readVersionSafe()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("installedVersion matches readVersionSafe", () => {
    expect(installedVersion()).toBe(readVersionSafe());
  });

  it("CLI --version prints the version and exits 0", async () => {
    const code = await main(["--version"]);
    expect(code).toBe(0);
    expect(await main(["version"])).toBe(0);
  });

  it("updateCheckEnabled honours ORION_UPDATE_CHECK=0", () => {
    const prev = process.env.ORION_UPDATE_CHECK;
    expect(updateCheckEnabled()).toBe(true);
    process.env.ORION_UPDATE_CHECK = "0";
    expect(updateCheckEnabled()).toBe(false);
    if (prev === undefined) delete process.env.ORION_UPDATE_CHECK;
    else process.env.ORION_UPDATE_CHECK = prev;
  });

  it("updateBanner renders a version line that always includes the installed version", () => {
    const b = updateBanner({ installed: "1.2.3", latest: null, updateAvailable: false, status: "offline" });
    expect(b).toContain("1.2.3");
    const up = updateBanner({ installed: "1.2.3", latest: "2.0.0", updateAvailable: true, status: "ok" });
    expect(up).toContain("2.0.0");
    expect(up).toContain("update available");
  });
});
