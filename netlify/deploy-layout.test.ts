// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import imageHandler, { config as imageConfig } from "./deploy-functions/openverse-image.mjs";
import searchHandler, { config as searchConfig } from "./deploy-functions/openverse-search.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const deployDirectory = join(here, "deploy-functions");
const expectedFunctions = ["openverse-image.mts", "openverse-search.mts"];

describe("Netlify deployment layout", () => {
  it("configures a wrapper-only directory containing exactly two functions", () => {
    const toml = readFileSync(join(repoRoot, "netlify.toml"), "utf8");
    expect(toml).toMatch(/^functions = "netlify\/deploy-functions"$/m);
    expect(existsSync(deployDirectory)).toBe(true);
    if (!existsSync(deployDirectory)) return;

    const entries = readdirSync(deployDirectory, { withFileTypes: true });
    expect(entries.every((entry) => entry.isFile())).toBe(true);
    const files = entries.map((entry) => entry.name).sort();
    expect(files).toEqual(expectedFunctions);
    expect(files.some((name) => name.includes(".test."))).toBe(false);
  });

  it("uses thin wrappers that re-export each tested source handler and config", () => {
    if (!existsSync(deployDirectory)) {
      expect(existsSync(deployDirectory)).toBe(true);
      return;
    }

    for (const filename of expectedFunctions) {
      const source = readFileSync(join(deployDirectory, filename), "utf8").trim();
      const moduleName = filename.replace(/\.mts$/, ".mjs");
      expect(source).toBe(`export { default, config } from "../functions/${moduleName}";`);
    }
    expect(typeof imageHandler).toBe("function");
    expect(typeof searchHandler).toBe("function");
    expect(imageConfig.path).toBe("/api/openverse-image/:id");
    expect(searchConfig.path).toBe("/api/openverse-search");
  });

  it("invokes the executable name exposed by the pinned Netlify CLI", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.dev).toBe("npxnetlify dev");
  });
});
