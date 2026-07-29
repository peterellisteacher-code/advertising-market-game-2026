import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PUBLIC_REPOSITORIES = Object.freeze([
  "https://github.com/peterellisteacher-code/advertising-market-game-2026.git"
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/u;

export function parseMainRef(repository, output) {
  const matches = String(output)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/u))
    .filter(
      ([sha, ref, ...rest]) =>
        rest.length === 0
        && SHA_PATTERN.test(sha ?? "")
        && ref === "refs/heads/main"
    );

  if (matches.length !== 1) {
    throw new Error(
      `${repository} did not return exactly one main ref; synchronization is unverified.`
    );
  }
  return matches[0][0];
}

export function assertRepositoriesMatch(refs, expectedHead = undefined) {
  if (!Array.isArray(refs) || refs.length !== PUBLIC_REPOSITORIES.length) {
    throw new Error("The sole canonical public repository main ref is required.");
  }
  const [canonical] = refs;
  if (canonical.repository !== PUBLIC_REPOSITORIES[0]) {
    throw new Error(
      `${canonical.repository} is not the sole canonical public repository.`
    );
  }
  if (expectedHead !== undefined && canonical.sha !== expectedHead) {
    throw new Error(
      `The canonical public repository does not match the checked-out release commit: `
      + `remote=${canonical.sha}, local=${expectedHead}.`
    );
  }
  return canonical.sha;
}

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0 || result.error !== undefined) {
    const detail = String(result.stderr || result.error?.message || "git failed").trim();
    throw new Error(`${args[0]} failed: ${detail}`);
  }
  return result.stdout;
}

function readRemoteMain(repository) {
  return {
    repository,
    sha: parseMainRef(
      repository,
      runGit(["ls-remote", "--exit-code", repository, "refs/heads/main"])
    )
  };
}

function localHead() {
  const sha = runGit(["rev-parse", "HEAD"]).trim();
  if (!SHA_PATTERN.test(sha)) {
    throw new Error("The checked-out HEAD is not a full Git commit SHA.");
  }
  return sha;
}

function parseArguments(argv) {
  if (argv.length === 0) return { expectLocalHead: false };
  if (argv.length === 1 && argv[0] === "--expect-local-head") {
    return { expectLocalHead: true };
  }
  throw new Error(
    "Usage: node scripts/verify-public-repository-sync.mjs [--expect-local-head]"
  );
}

async function main() {
  const { expectLocalHead } = parseArguments(process.argv.slice(2));
  const refs = PUBLIC_REPOSITORIES.map(readRemoteMain);
  const sha = assertRepositoriesMatch(refs, expectLocalHead ? localHead() : undefined);
  console.log(`CANONICAL_PUBLIC_REPOSITORY_VERIFIED ${sha}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
