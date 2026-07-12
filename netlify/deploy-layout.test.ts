// @vitest-environment node

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const deployDirectory = join(here, "deploy-functions");
const expectedFunctions = ["openverse-image.mts", "openverse-search.mts"];

interface DiscoveredFunction {
  mainFile: string;
  name: string;
  routes?: Array<Record<string, unknown>>;
  runtimeAPIVersion?: number;
}

interface ExtractedIsc {
  config: {
    path?: string[];
    rateLimit?: {
      aggregateBy?: string[];
      windowLimit?: number;
      windowSize?: number;
    };
  };
}

const loadStaticDiscovery = async (): Promise<{
  listFunctions: (
    directory: string,
    options: { parseISC: true }
  ) => Promise<DiscoveredFunction[]>;
  parseFile: (
    filename: string,
    options: { functionName: string }
  ) => Promise<ExtractedIsc>;
}> => {
  const netlifyPackage = realpathSync(join(repoRoot, "node_modules", "netlify", "package.json"));
  const requireFromNetlify = createRequire(netlifyPackage);
  const zisiEntry = requireFromNetlify.resolve("@netlify/zip-it-and-ship-it");
  const zisi = await import(pathToFileURL(zisiEntry).href) as {
    listFunctions: (
      directory: string,
      options: { parseISC: true }
    ) => Promise<DiscoveredFunction[]>;
  };
  const iscEntry = resolve(dirname(zisiEntry), "runtimes", "node", "in_source_config", "index.js");
  const isc = await import(pathToFileURL(iscEntry).href) as {
    parseFile: (
      filename: string,
      options: { functionName: string }
    ) => Promise<ExtractedIsc>;
  };
  return { listFunctions: zisi.listFunctions, parseFile: isc.parseFile };
};

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

  it("uses thin wrappers with a local literal config and the tested source handler", () => {
    if (!existsSync(deployDirectory)) {
      expect(existsSync(deployDirectory)).toBe(true);
      return;
    }

    for (const filename of expectedFunctions) {
      const source = readFileSync(join(deployDirectory, filename), "utf8").trim();
      const moduleName = filename.replace(/\.mts$/, ".mjs");
      expect(source).toContain(`export { default } from "../functions/${moduleName}";`);
      expect(source).toContain("export const config = {");
      expect(source).not.toContain("export { default, config }");
    }
  });

  it("exposes both routes and rate limits to Netlify static discovery", async () => {
    const { listFunctions, parseFile } = await loadStaticDiscovery();
    const discovered = await listFunctions(deployDirectory, { parseISC: true });
    const byName = new Map(discovered.map((entry) => [entry.name, entry]));

    expect([...byName.keys()].sort()).toEqual(["openverse-image", "openverse-search"]);
    expect(discovered).toHaveLength(2);
    expect(byName.get("openverse-image")?.runtimeAPIVersion).toBe(2);
    expect(byName.get("openverse-search")?.runtimeAPIVersion).toBe(2);
    expect(byName.get("openverse-image")?.routes).toEqual([{
      pattern: "/api/openverse-image/:id",
      expression: "^\\/api\\/openverse-image(?:\\/([^\\/]+?))\\/?$",
      methods: []
    }]);
    expect(byName.get("openverse-search")?.routes).toEqual([{
      pattern: "/api/openverse-search",
      literal: "/api/openverse-search",
      methods: []
    }]);

    const extracted = Object.fromEntries(await Promise.all(discovered.map(async (entry) => [
      entry.name,
      (await parseFile(entry.mainFile, { functionName: entry.name })).config
    ])));
    expect(extracted).toEqual({
      "openverse-image": {
        path: ["/api/openverse-image/:id"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 600,
          windowSize: 60
        }
      },
      "openverse-search": {
        path: ["/api/openverse-search"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 120,
          windowSize: 60
        }
      }
    });

    const sourceExtracted = Object.fromEntries(await Promise.all(discovered.map(async (entry) => [
      entry.name,
      (await parseFile(
        join(here, "functions", `${entry.name}.mts`),
        { functionName: entry.name }
      )).config
    ])));
    expect(sourceExtracted).toEqual(extracted);
  }, 20_000);

  it("invokes the executable name exposed by the pinned Netlify CLI", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.dev).toBe("npxnetlify dev");
  });
});
