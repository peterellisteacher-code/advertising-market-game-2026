// @vitest-environment node

import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const deployDirectory = join(here, "deploy-functions");
const bundleDirectory = join(here, "function-bundles");
const expectedFunctions = [
  "account-assets.mts",
  "account-progress.mts",
  "account-reset.mts",
  "account-session.mts",
  "image-lab-jobs.mts",
  "image-lab-session.mts",
  "market-room.mts",
  "market-session.mts",
  "openverse-image.mts",
  "openverse-search.mts",
  "product-price-guide.mts",
  "studio-coach.mts",
  "teacher-session.mts"
];

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
  it("configures a wrapper-only directory containing exactly thirteen functions", () => {
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

  it("bundles Netlify Blobs into each function instead of shipping Windows pnpm links", () => {
    for (const configName of ["netlify.toml", "netlify.artifact.toml"]) {
      const toml = readFileSync(join(repoRoot, configName), "utf8");
      expect(toml).toMatch(/^node_bundler = "esbuild"$/m);
      expect(toml).not.toMatch(/^external_node_modules\s*=.*@netlify\/blobs/m);
    }

    for (const adapterName of [
      "netlify-account-assets.ts",
      "netlify-image-lab-state.ts",
      "netlify-market-room.ts"
    ]) {
      const source = readFileSync(join(here, "functions", "lib", adapterName), "utf8");
      expect(source).toContain('import { getStore } from "@netlify/blobs";');
      expect(source).not.toMatch(/import\([^)]*@netlify\/blobs/u);
      expect(source).not.toContain('const moduleName = "@netlify/blobs";');
    }
  });

  it("uses thin wrappers with a local literal config and the intended handler", () => {
    if (!existsSync(deployDirectory)) {
      expect(existsSync(deployDirectory)).toBe(true);
      return;
    }

    for (const filename of expectedFunctions) {
      const source = readFileSync(join(deployDirectory, filename), "utf8").trim();
      const moduleName = filename.replace(/\.mts$/, ".mjs");
      const handler = `../function-bundles/${moduleName}`;
      expect(source).toContain(`export { default } from "${handler}";`);
      expect(source).toContain("export const config = {");
      expect(source).not.toContain("export { default, config }");
    }
  });

  it("emits one self-contained server bundle for every deployed function", () => {
    for (const filename of expectedFunctions) {
      const bundleName = filename.replace(/\.mts$/, ".mjs");
      const bundlePath = join(bundleDirectory, bundleName);
      expect(existsSync(bundlePath), `${bundleName} must be built before deployment`).toBe(true);
      if (!existsSync(bundlePath)) continue;

      const source = readFileSync(bundlePath, "utf8");
      const importSpecifiers = [...source.matchAll(/\b(?:from|import)\s*["']([^"']+)["']/gu)]
        .flatMap((match) => match[1] === undefined ? [] : [match[1]]);
      expect(importSpecifiers.every(
        (specifier) => specifier.startsWith("node:") || builtinModules.includes(specifier)
      )).toBe(true);
      expect(source).not.toMatch(/\bimport\s*\(/u);
      expect(source).not.toMatch(/\brequire\s*\(/u);
    }
  });

  it("exposes every route and rate limit to Netlify static discovery", async () => {
    const { listFunctions, parseFile } = await loadStaticDiscovery();
    const discovered = await listFunctions(deployDirectory, { parseISC: true });
    const byName = new Map(discovered.map((entry) => [entry.name, entry]));

    expect([...byName.keys()].sort()).toEqual([
      "account-assets",
      "account-progress",
      "account-reset",
      "account-session",
      "image-lab-jobs",
      "image-lab-session",
      "market-room",
      "market-session",
      "openverse-image",
      "openverse-search",
      "product-price-guide",
      "studio-coach",
      "teacher-session"
    ]);
    expect(discovered).toHaveLength(13);
    for (const entry of discovered) expect(entry.runtimeAPIVersion).toBe(2);
    expect(byName.get("account-session")?.routes).toEqual([
      {
        pattern: "/api/account/signup",
        literal: "/api/account/signup",
        methods: []
      },
      {
        pattern: "/api/account/login",
        literal: "/api/account/login",
        methods: []
      },
      {
        pattern: "/api/account/session",
        literal: "/api/account/session",
        methods: []
      },
      {
        pattern: "/api/account/logout",
        literal: "/api/account/logout",
        methods: []
      }
    ]);
    expect(byName.get("account-progress")?.routes).toEqual([{
      pattern: "/api/account/progress",
      literal: "/api/account/progress",
      methods: []
    }]);
    expect(byName.get("account-reset")?.routes).toEqual([{
      pattern: "/api/account/reset",
      literal: "/api/account/reset",
      methods: []
    }]);
    expect(byName.get("account-assets")?.routes).toEqual([{
      pattern: "/api/account/assets/:sha256",
      expression: "^\\/api\\/account\\/assets(?:\\/([^\\/]+?))\\/?$",
      methods: []
    }]);
    expect(byName.get("image-lab-session")?.routes).toEqual([
      {
        pattern: "/api/image-lab/config",
        literal: "/api/image-lab/config",
        methods: []
      },
      {
        pattern: "/api/image-lab/unlock",
        literal: "/api/image-lab/unlock",
        methods: []
      },
      {
        pattern: "/api/image-lab/lock",
        literal: "/api/image-lab/lock",
        methods: []
      }
    ]);
    expect(byName.get("image-lab-jobs")?.routes).toEqual([
      {
        pattern: "/api/image-lab/jobs",
        literal: "/api/image-lab/jobs",
        methods: []
      },
      {
        pattern: "/api/image-lab/assets",
        literal: "/api/image-lab/assets",
        methods: []
      }
    ]);
    expect(byName.get("studio-coach")?.routes).toEqual([{
      pattern: "/api/image-lab/coach",
      literal: "/api/image-lab/coach",
      methods: []
    }]);
    expect(byName.get("teacher-session")?.routes).toEqual([
      {
        pattern: "/api/teacher/login",
        literal: "/api/teacher/login",
        methods: []
      },
      {
        pattern: "/api/teacher/session",
        literal: "/api/teacher/session",
        methods: []
      },
      {
        pattern: "/api/teacher/logout",
        literal: "/api/teacher/logout",
        methods: []
      }
    ]);
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
    expect(byName.get("product-price-guide")?.routes).toEqual([{
      pattern: "/api/product-price-guide",
      literal: "/api/product-price-guide",
      methods: []
    }]);
    expect(byName.get("market-session")?.routes).toEqual([
      {
        pattern: "/api/market/create",
        literal: "/api/market/create",
        methods: []
      },
      {
        pattern: "/api/market/join",
        literal: "/api/market/join",
        methods: []
      }
    ]);
    expect(byName.get("market-room")?.routes).toEqual([
      {
        pattern: "/api/market/resume",
        literal: "/api/market/resume",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/snapshot",
        literal: "/api/market/snapshot",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/artwork",
        literal: "/api/market/artwork",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/publish",
        literal: "/api/market/publish",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/award",
        literal: "/api/market/award",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/purchase",
        literal: "/api/market/purchase",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/finish",
        literal: "/api/market/finish",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/review",
        literal: "/api/market/review",
        methods: [],
        prefer_static: undefined
      },
      {
        pattern: "/api/market/control",
        literal: "/api/market/control",
        methods: [],
        prefer_static: undefined
      }
    ]);

    const extracted = Object.fromEntries(await Promise.all(discovered.map(async (entry) => [
      entry.name,
      (await parseFile(entry.mainFile, { functionName: entry.name })).config
    ])));
    expect(extracted).toEqual({
      "account-assets": {
        path: ["/api/account/assets/:sha256"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 120,
          windowSize: 60
        }
      },
      "account-progress": {
        path: ["/api/account/progress"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 120,
          windowSize: 60
        }
      },
      "account-reset": {
        path: ["/api/account/reset"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 300,
          windowSize: 60
        }
      },
      "account-session": {
        path: [
          "/api/account/signup",
          "/api/account/login",
          "/api/account/session",
          "/api/account/logout"
        ],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 300,
          windowSize: 60
        }
      },
      "image-lab-jobs": {
        path: ["/api/image-lab/jobs", "/api/image-lab/assets"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 1_200,
          windowSize: 60
        }
      },
      "image-lab-session": {
        path: ["/api/image-lab/config", "/api/image-lab/unlock", "/api/image-lab/lock"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 300,
          windowSize: 60
        }
      },
      "market-room": {
        path: [
          "/api/market/resume",
          "/api/market/snapshot",
          "/api/market/artwork",
          "/api/market/publish",
          "/api/market/award",
          "/api/market/purchase",
          "/api/market/finish",
          "/api/market/review",
          "/api/market/control"
        ],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 1_200,
          windowSize: 60
        }
      },
      "market-session": {
        path: ["/api/market/create", "/api/market/join"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 120,
          windowSize: 60
        }
      },
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
      },
      "product-price-guide": {
        path: ["/api/product-price-guide"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 300,
          windowSize: 60
        }
      },
      "studio-coach": {
        path: ["/api/image-lab/coach"],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 300,
          windowSize: 60
        }
      },
      "teacher-session": {
        path: [
          "/api/teacher/login",
          "/api/teacher/session",
          "/api/teacher/logout"
        ],
        rateLimit: {
          aggregateBy: ["ip", "domain"],
          windowLimit: 30,
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
  }, 60_000);

  it("invokes the executable name exposed by the pinned Netlify CLI", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.dev).toBe(
      "node scripts/build-netlify-functions.mjs && npx netlify dev"
    );
  });
});
