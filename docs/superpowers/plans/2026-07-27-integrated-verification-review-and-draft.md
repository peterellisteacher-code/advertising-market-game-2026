# Integrated Verification, Independent Review and Non-Production Draft Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use the separately authorised `superpowers:requesting-code-review` reviewer only at Task 4. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the four completed implementation streams into one reproducible release candidate, apply the two objective language workflows exactly once, verify the complete candidate, obtain the requested independent reviews, publish a curated public-source update, deploy an unprotected non-production QA draft, and record current browser evidence without changing production.

**Architecture:** One release ledger binds the authoritative candidate SHA, student-copy corpus hash, public-snapshot manifest, GitHub Actions source SHA, downloaded artifact hash, release manifest, QA deploy and browser evidence. Deterministic verification precedes model review. The source review and five-model panel each run once against the same neutral stable evidence. Only genuine Critical or Important findings receive one bounded repair pass. The public repository remains a curated source mirror; the QA site remains a secret-free, non-production surface with deterministic fake identities and API state.

**Tech Stack:** PowerShell, Git, pnpm 11, Node.js 22, TypeScript 7, Vitest 4, Python 3.12/Pytest/Pillow, GitHub Actions on Ubuntu 24.04 and pinned Godot CI, Netlify draft deployment, current in-app browser control, OpenRouter governed workflows.

**Approved specification:** `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Implementation dependencies:**

- `docs/superpowers/plans/2026-07-27-student-teacher-access-and-account-controls.md`
- `docs/superpowers/plans/2026-07-27-image-lab-teacher-allowances.md`
- `docs/superpowers/plans/2026-07-27-studio-editor-completion.md`
- `docs/superpowers/plans/2026-07-27-guidance-and-playtest-closure.md`

## Global Constraints

- Do not claim completion from an earlier run. Every terminal claim must cite fresh output from the final unchanged candidate.
- Run the complete student corpus through one Plain Language request and then one complete Claude Scrubber MICROCOPY pass. The scrubber pass uses deterministic size-bounded sections because its governed output ceiling is 4,000 tokens; every section is sent once with no local guidance.
- Run exactly one fresh `superpowers:requesting-code-review` pass and exactly one five-model coding panel. Do not create a reviewer loop.
- The requested panel roster is HY3, GLM-5.2, K3, DeepSeek V4 Pro and Claude Opus 5. Do not substitute K2.7 Code or Claude Opus 4.8.
- Use the Plain Language skill's bundled direct runner for its frozen-preset call and the Codex-owned `openrouter-exec` server for every other billable OpenRouter model call. Never use Claude-owned credentials or servers.
- Supply no student-identifying information, real credentials, secrets, prior reviewer output, preferred verdict or suspected-finding list to external reviewers.
- Do not launch a Windows Godot executable. Godot tests and export run only in the pinned Linux GitHub Actions job.
- Do not deploy production, alter the production visitor gate, add a production alias, or change the production site.
- Use only the dedicated unprotected QA project `codex-browser-qa-harness` (`8edde91e-88ad-4a96-a49b-ddb8470d27c0`) for browser evidence.
- The QA project contains no production secret, real account, student data, paid endpoint, extension or production Function. Its fake identities and API state are deterministic and visibly identified in retained evidence.
- A deterministic QA Function proves the UI-to-API contract only. It does not prove the production Function, Supabase, visitor gate, hosted headers, edge routing or edge rate limiting.
- Any shared-Supabase change is limited to the named Advertising Market Game objects and occurs only through the short reserve/apply/verify/release sequence in Task 6. Never touch a `signal_lost` object.
- Keep the public repository history free of internal specifications, plans, reviews, operational evidence, credentials and private deployment identifiers.
- Do not delete, replace or move a file or directory without Peter's explicit deletion approval and the required before/after notification. Create fresh retained paths and fail closed when a proposed path already exists.

---

### Task 1: Run the objective language workflows once on the stable corpus

**Files:**
- Read: `C:\Users\Peter Ellis\.agents\skills\plain-language\SKILL.md`
- Read: `C:\Users\Peter Ellis\.agents\skills\claude-scrubber\SKILL.md`
- Read: `C:\Users\Peter Ellis\.agents\skills\claude-scrubber\scrub-prompt-microcopy.txt`
- Read: `scripts/student-copy-corpus.mjs`
- Create: `scripts/student-copy-scrub-sections.mjs`
- Create: `scripts/student-copy-scrub-sections.test.mjs`
- Modify only where an accepted response supplies exact meaning-preserving copy: student-facing source files named by the corpus
- Create: a new retained corpus/evidence directory under `C:\tmp`
- Read: `reviews/student-copy-completion-candidate.json`
- Create: `reviews/student-copy-language-applied-paths.txt`
- Create: `reviews/student-copy-language-gate-2026-07-27.md`

**Interfaces:**

- Authored input: the complete stable JSON corpus generated by `scripts/student-copy-corpus.mjs`.
- Plain Language call: exactly the frozen `@preset/plain-language-coach` contract with the corpus bytes as the sole user-message content.
- MICROCOPY pass: one deterministic set of unique-text sections, each at most 12,000 UTF-8 bytes, covering every corpus occurrence through a separate manifest. Each section is one unmodified user prompt sent once with the installed prompt bytes as `system`, `google/gemini-3.1-flash-lite`, `temperature: 0.2`, `max_tokens: 4000`, and no `reasoning` field.
- Exit evidence: full input, response, section-manifest and final-corpus SHA-256 values plus a passing MICROCOPY diff guard for every section.

The pre-plan corpus currently contains 1,386 occurrences and 248,037 UTF-8 bytes; its 1,248 unique strings occupy 43,837 bytes. A single scrubber response cannot faithfully reproduce that corpus inside the skill's 4,000-token output ceiling. Deterministic sectioning follows the skill's explicit “one section of a large artefact per call” route without selecting suspected phrases or guiding the scan.

- [ ] **Step 1: Write the deterministic sectioner tests**

For fixtures with duplicate copy, long source files and non-ASCII punctuation, require:

- every unique string appears exactly once;
- the manifest maps it back to every stable copy ID and source occurrence;
- source order and first-occurrence order are deterministic;
- no string is split;
- each section is at most 12,000 UTF-8 bytes;
- concatenating section lines reproduces the ordered unique-text corpus exactly;
- output files and directories must not already exist.

- [ ] **Step 2: Implement and verify the sectioner**

Expose required `--corpus`, `--output-dir` and `--max-utf8-bytes` flags. The exact execution command appears in Step 6 after the absolute paths have been established.

The output directory contains `manifest.json` and zero-padded `section-001.txt` files. The manifest records each section hash, byte count, ordered line number, text hash and all copy IDs/source occurrences; it does not insert IDs into the text sent to the model.

```powershell
node --test scripts/student-copy-scrub-sections.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
```

- [ ] **Step 3: Create a fresh retained language root and prove the authored corpus**

```powershell
$candidateShortSha = (git rev-parse --short=12 HEAD).Trim()
$languageRoot = "C:\tmp\admarket-language-gate-$candidateShortSha"
if (Test-Path -LiteralPath $languageRoot) { throw "Fresh language-gate path already exists" }
New-Item -ItemType Directory -Path $languageRoot | Out-Null
$objectiveInput = Join-Path $languageRoot "student-copy-objective-input.json"
$plainResponse = Join-Path $languageRoot "plain-language-response.txt"
node scripts/student-copy-corpus.mjs --root . --output $objectiveInput
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
Get-FileHash -Algorithm SHA256 $objectiveInput
```

Compare `$objectiveInput` with the tracked candidate produced by Guidance Task 7 and explain any difference before calling a model. The root and every output file must be new. Retain the root; do not delete it.

- [ ] **Step 4: Make the single Plain Language request**

Read `plain-language/SKILL.md` again immediately before the call. Use its bundled direct runner with `--prompt-file` and `--output-file`. The prompt file is the complete corpus, unmodified. Add no preface, defect list, desired verdict, system message or model parameter.

```powershell
node "C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.cjs" --prompt-file $objectiveInput --output-file $plainResponse
```

Expected stdout: exactly `plain_language_response_saved`.

Record input and response SHA-256 values. A saved non-empty response is the completed paid call even if shell display would have truncated it. Do not call again.

- [ ] **Step 5: Adjudicate the Plain Language response without local stylistic rewriting**

For every proposed change:

1. map it to a stable copy ID and current source string;
2. reject meaning loss, changed game rules, inaccessible labels or inaccurate promises;
3. accept an edit only by applying the response wording exactly;
4. record rejected items with the factual reason;
5. run the focused copy and owning component tests.

Codex may repair source wiring needed to carry accepted wording but must not write a stylistic alternative.

- [ ] **Step 6: Generate the complete post-Plain-Language scrub sections**

```powershell
$postPlainCorpus = Join-Path $languageRoot "student-copy-post-plain.json"
$scrubInputRoot = Join-Path $languageRoot "scrub-input"
node scripts/student-copy-corpus.mjs --root . --output $postPlainCorpus
node scripts/student-copy-scrub-sections.mjs --corpus $postPlainCorpus --output-dir $scrubInputRoot --max-utf8-bytes 12000
node --test scripts/student-copy-scrub-sections.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
Get-FileHash -Algorithm SHA256 $postPlainCorpus
Get-FileHash -Algorithm SHA256 (Join-Path $scrubInputRoot "manifest.json")
```

Require the manifest to cover every copy ID in the full corpus and every unique text exactly once.

- [ ] **Step 7: Run one complete Claude Scrubber MICROCOPY pass**

Read `claude-scrubber/SKILL.md` and `scrub-prompt-microcopy.txt` byte-for-byte immediately before the first section. For each manifest section in order, send that section's exact bytes as the user prompt with nothing added. Use the skill's exact MICROCOPY call shape and capture the returned text byte-for-byte to a new matching file under `$languageRoot\scrub-output`.

Use the Codex-owned OpenRouter execution surface required by project policy. Do not use an Anthropic or Codex model. Do not add a reasoning field. Do not locally post-clean a response. Each valid section response completes that section's paid call and must not be repeated.

```powershell
$scrubOutputRoot = Join-Path $languageRoot "scrub-output"
if (Test-Path -LiteralPath $scrubOutputRoot) { throw "Fresh scrub-output path already exists" }
New-Item -ItemType Directory -Path $scrubOutputRoot | Out-Null
```

- [ ] **Step 8: Run the mandatory MICROCOPY diff guard on every section**

```powershell
$scrubDiffRoot = Join-Path $languageRoot "scrub-diff"
New-Item -ItemType Directory -Path $scrubDiffRoot | Out-Null
Get-ChildItem -LiteralPath $scrubInputRoot -Filter "section-*.txt" | Sort-Object Name | ForEach-Object {
  $responsePath = Join-Path $scrubOutputRoot $_.Name
  $diffPath = Join-Path $scrubDiffRoot $_.Name
  python "C:\Users\Peter Ellis\.agents\skills\claude-scrubber\scripts\diff-guard.py" $_.FullName $responsePath *>&1 | Tee-Object -FilePath $diffPath
  if ($LASTEXITCODE -ne 0) { throw "MICROCOPY diff guard rejected $($_.Name)" }
}
```

Require exit `0` for every section. Inspect every `WARN imported-tell?` line. Reject a section if it changes protected chrome, changes more than the permitted proportion, loses meaning or introduces an unacceptable tell. Do not repair a rejected scrub locally and do not repeat valid paid sections.

- [ ] **Step 9: Apply only accepted verbatim scrub changes and re-prove the corpus**

Use the manifest to map changed line text to every source occurrence. Apply returned wording exactly or reject it; do not author a third wording. Write the sorted exact changed source paths to `reviews/student-copy-language-applied-paths.txt`. Then run:

```powershell
$postScrubCorpus = Join-Path $languageRoot "student-copy-post-scrub.json"
node scripts/student-copy-corpus.mjs --root . --output $postScrubCorpus
node --test scripts/student-copy-scrub-sections.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
Get-FileHash -Algorithm SHA256 $postScrubCorpus
```

If every scrub response is byte-identical to its input, record that fact and make no scrub-driven source change.

- [ ] **Step 10: Write the compact gate record and commit**

`reviews/student-copy-language-gate-2026-07-27.md` records:

- retained `$languageRoot`;
- complete input/post-Plain/post-scrub hashes;
- Plain Language response hash and exact call count `1`;
- scrub manifest hash, section count, each input/response/diff hash and exact total call count;
- accepted and rejected wording with factual adjudication only;
- applied source paths;
- focused test counts.

```powershell
$acceptedSourcePaths = @(Get-Content -LiteralPath reviews/student-copy-language-applied-paths.txt | Where-Object { $_.Trim() -ne "" })
if ($acceptedSourcePaths.Count -gt 0) { git add -- $acceptedSourcePaths }
git add -- scripts/student-copy-scrub-sections.mjs scripts/student-copy-scrub-sections.test.mjs scripts/student-copy-corpus.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs reviews/student-copy-completion-candidate.json reviews/student-copy-language-applied-paths.txt reviews/student-copy-language-gate-2026-07-27.md
git commit -m "copy(student): complete objective language gates"
```

Before committing, inspect the staged file list and unstage any unrelated or Claude-owned path. Raw corpus/model/diff files remain in the retained language root and outside both the private and public repository histories.

---

### Task 2: Produce the stable deterministic release candidate

**Files:**
- Modify when required by the four implementation plans: application source and focused tests
- Modify: `package.json` only when a newly added deterministic contract must join `test:build-web`
- Modify: `docs/operations/release-workflow.md`
- Modify: `docs/operations/advertising-game-account-progress.md`
- Modify: `docs/operations/image-lab.md`
- Read: `.github/workflows/build-and-publish.yml`
- Read: `scripts/verify-web-export.mjs`
- Read: `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Interfaces:**

- Pre-change identity: the commit immediately before implementation began.
- Candidate identity: one clean local commit after every accepted language edit.
- Verification ledger: command, start/end time, exit code, passed/failed count and log path for each gate.

- [ ] **Step 1: Run every changed subsystem's focused checks**

Execute the focused commands named in all four implementation plans. Include:

```powershell
pnpm run typecheck
python -m pytest pipeline/tests -q
node --test scripts/build-logo-icons.test.mjs scripts/build-netlify-functions.test.mjs scripts/build-web.test.mjs scripts/deploy-netlify-artifact.test.mjs scripts/dev-preview.test.mjs scripts/export-godot-web.test.mjs scripts/github-workflow.test.mjs scripts/godot-bridge-contract.test.mjs scripts/onboarding-source.test.mjs scripts/public-release-contract.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/student-copy-source-coverage.test.mjs
```

Add any new Node contract file to the explicit command and to `test:build-web`.

- [ ] **Step 2: Run the serialized application suite once**

```powershell
pnpm run test
```

Capture stdout/stderr to a new retained log. Require zero failed files and zero failed tests. Do not rerun while inputs remain unchanged.

- [ ] **Step 3: Run non-Godot local build contracts**

```powershell
pnpm run build:functions
pnpm run build:studio
pnpm run build:logo-icons
pnpm run test:build-web
git diff --check
```

Do not run `pnpm run build:web` on Windows because it invokes the quarantined native Godot exporter. Full web assembly occurs from the supported Linux CI artifact in Task 7.

- [ ] **Step 4: Update operations and verify the acceptance checklist line by line**

Before evaluating the checklist, update the operator guides to document:

- student URL `/student`;
- teacher URL `/teacher`;
- teacher password configuration and session boundary without exposing any HMAC secret;
- typed/generated/replaced pair passwords and immediate session invalidation;
- pair reset and isolated teacher factory-reset confirmation words;
- Image Lab global/default/per-pair/batch allowance semantics;
- uncertain reservation handling;
- migration object names and rollback/operator observations;
- production deployment remains a separate explicit action.

Use Section 22 of the approved specification. For each criterion record exactly one of:

- focused deterministic evidence complete;
- requires current browser evidence in Task 9;
- requires controlled Supabase application in Task 6; or
- Safari/school-wifi field gate remains unmeasured.

No criterion may be silently omitted or inferred from the total test count.

- [ ] **Step 5: Freeze the candidate commit**

```powershell
git status --short
git diff --check
git rev-parse HEAD
```

Commit any final deterministic-only repair with a scoped message. Require a clean worktree before creating the review bundle. Record the candidate SHA and do not change it except through Task 5's single bounded finding-resolution path.

---

### Task 3: Build and validate the exact curated public snapshot locally

**Files:**
- Read: all files tracked by the current public repository
- Read: current authoritative candidate
- Create: `reviews/public-snapshot-manifest-2026-07-27.txt`
- Create: `reviews/public-snapshot-diff-2026-07-27.txt`
- Create: `reviews/public-snapshot-privacy-scan-2026-07-27.txt`
- Create: a new retained public-candidate repository under `C:\tmp`

**Interfaces:**

- Public repository: `https://github.com/peterellisteacher-code/advertising-market-game`
- Allowlist basis: the existing public main tree plus new files required to build, test, operate and license this candidate.
- Exclusions: `docs/superpowers/**`, `reviews/**`, private release records, local Netlify state, `.env*`, secrets, private deployment identifiers, personal paths, panel output and temporary evidence.

- [ ] **Step 1: Create a fresh retained public-candidate checkout**

Resolve and create the path without deleting or reusing an earlier checkout:

```powershell
$candidateShortSha = (git rev-parse --short=12 HEAD).Trim()
$publicCandidatePath = "C:\tmp\admarket-public-candidate-$candidateShortSha"
if (Test-Path -LiteralPath $publicCandidatePath) { throw "Fresh public-candidate path already exists" }
git clone https://github.com/peterellisteacher-code/advertising-market-game.git $publicCandidatePath
```

- [ ] **Step 2: Generate the exact allowlist before copying**

Start from the public repository's tracked main-tree paths. Add only new candidate files required by imports, tests, build scripts, operations documentation, licences or the workflow. For each addition, record its importing or execution consumer.

Write the sorted slash-normalised allowlist and SHA-256 for every file to `reviews/public-snapshot-manifest-2026-07-27.txt`. No wildcard description counts as the manifest.

- [ ] **Step 3: Copy only allowlisted bytes**

Copy each manifest entry from the authoritative candidate to the public-candidate checkout. Fail if an allowlisted source is missing or if the destination would escape the checkout. Remove nothing from the public checkout unless the exact removal is already required by the approved public-litter decision and Peter has received the deletion notice required by project policy.

- [ ] **Step 4: Prove normalized source equivalence**

For every changed implementation/test/build file in the authoritative candidate:

1. require presence in the public manifest;
2. compare binary files by SHA-256;
3. compare text after newline normalization only;
4. record equality or an explained public-only difference.

Write the exact authoritative-to-public diff and public base/candidate SHAs to `reviews/public-snapshot-diff-2026-07-27.txt`.

- [ ] **Step 5: Run the privacy, credential, workflow and licence gates**

The scan must cover the public working tree and its public history. Require:

- no `.env`, `.netlify/state.json`, private key, bearer token, PAT, API key or service-role value;
- no personal/student data, Peter-specific operational prose, local user path or private deploy record;
- no workflow step that deploys, writes repository content, uses a secret or grants more than `contents: read`;
- all external Actions remain SHA-pinned;
- all redistributed assets have an applicable project or vendor licence/credit;
- no removed review/plan file is imported, linked or required by a test/build step.

Save sanitised command results to `reviews/public-snapshot-privacy-scan-2026-07-27.txt`. Do not print a discovered credential value; record only the path, detector and remediation status.

- [ ] **Step 6: Validate the snapshot from a clean install**

In the fresh public checkout:

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run test:build-web
python -m pytest pipeline/tests -q
git diff --check
git status --short
```

Require the only changes to be the intended candidate update before committing the public candidate locally. Do not push yet.

- [ ] **Step 7: Commit the private review evidence**

```powershell
git add reviews/public-snapshot-manifest-2026-07-27.txt reviews/public-snapshot-diff-2026-07-27.txt reviews/public-snapshot-privacy-scan-2026-07-27.txt
git commit -m "docs(release): bind the curated public candidate"
```

These internal evidence files stay in the authoritative private branch and are excluded from the public repository.

---

### Task 4: Run the one fresh source review and one requested coding panel

**Files:**
- Read: `C:\Users\Peter Ellis\.codex\plugins\cache\openai-curated-remote\superpowers\6.2.0\skills\requesting-code-review\SKILL.md`
- Read: `C:\Users\Peter Ellis\.codex\plugins\cache\openai-curated-remote\superpowers\6.2.0\skills\requesting-code-review\code-reviewer.md`
- Read: approved specification and all five implementation plans
- Read: candidate diff, tests, public manifest/diff/privacy scan, SQL, operation guides and workflow
- Create: `reviews/release-readiness-code-review-2026-07-27.md`
- Create: `reviews/release-readiness-coding-panel-2026-07-27.json`
- Create: `reviews/release-readiness-review-bundle-2026-07-27.md`

**Interfaces:**

- Local reviewer: fresh read-only subagent, no inherited conversation, exact base/candidate SHAs and repository access.
- External panel: five independent calls through `openrouter-exec`, identical neutral evidence, no access to local secrets or private/student data.
- Output categories: Critical, Important and Minor plus release-readiness verdict.

- [ ] **Step 1: Build one neutral immutable review bundle**

Include:

- the approved requirements and implementation-plan paths;
- the pre-change and candidate SHAs;
- exact changed-file list and diff stat;
- exact public-snapshot manifest and diff;
- deterministic test/build logs;
- current browser evidence available before publication, with pending hosted checks labelled pending;
- relevant SQL, broker, teacher-session, release-script and workflow files;
- licence/asset-provenance evidence;
- neutral operational facts about scope, privacy, reversibility and compatibility.

Exclude prior reviewer output, preferred verdict, suspected defects and author-written proposed mitigations. Hash the completed bundle before any reviewer sees it.

- [ ] **Step 2: Dispatch exactly one `superpowers:requesting-code-review` reviewer**

Use the installed `code-reviewer.md` template. The reviewer is read-only and receives no inherited conversation. Ask it to assess plan alignment and release readiness, including:

- whether the public cleanup removed a required build/runtime/test input;
- whether private/internal material or credentials remain;
- whether licensing and asset-provenance claims are supported;
- whether the clean public snapshot is reproducibly buildable;
- whether any workflow can deploy, mutate or expose secrets;
- migration safety, authentication boundaries, allowance atomicity, reset scope, offline failure semantics, accessibility and test realism.

Capture its response verbatim in `reviews/release-readiness-code-review-2026-07-27.md`. Do not ask the reviewer to edit.

- [ ] **Step 3: Resolve the current OpenRouter roster before spending**

Discover the current catalogue identifiers for exactly:

- HY3;
- GLM-5.2;
- K3;
- DeepSeek V4 Pro;
- Claude Opus 5.

Record the identifiers without making an inference call. If K3 or Claude Opus 5 is unavailable or ambiguously named, stop and report the exact catalogue limitation. Do not substitute another model.

- [ ] **Step 4: Run the five independent panel calls once**

Use `openrouter-exec` for every call. Send the same hashed neutral review bundle to each model in a fresh isolated conversation. Ask for findings by Critical/Important/Minor severity and a release-readiness verdict. Do not disclose the other models' outputs.

Capture generation IDs, exact model IDs, usage metadata and verbatim results in `reviews/release-readiness-coding-panel-2026-07-27.json`. Aggregate only after all five calls finish. Do not call a final-writer model and do not run a second panel.

- [ ] **Step 5: Classify findings without inflating or suppressing them**

Create one table:

```text
Source | Finding | Severity asserted | Parent classification | Evidence | Resolution
```

Technical disagreement must cite source or test evidence. Minor observations may be recorded for later. Every genuine Critical or Important item proceeds to Task 5.

---

### Task 5: Resolve genuine release-blocking findings once and refreeze

**Files:**
- Modify only files required by a genuine Critical or Important finding
- Modify: `reviews/release-readiness-code-review-2026-07-27.md`
- Modify: `reviews/release-readiness-coding-panel-2026-07-27.json`

- [ ] **Step 1: Write a failing regression before each behavioural repair**

For every accepted behavioural finding, state its falsifier and reproduce it on the reference surface. Add the smallest focused regression. Do not implement speculative or Minor scope.

- [ ] **Step 2: Apply the bounded repair**

Keep the repair within the approved specification. Preserve teacher/student separation, reset recovery, idempotency, offline honesty, public-source exclusions and native-Godot quarantine.

- [ ] **Step 3: Run affected checks**

Run the owning test file, TypeScript check when TypeScript changed, SQL contract when SQL changed, and build contract when packaging changed.

- [ ] **Step 4: Repeat the final deterministic suite once if the candidate changed**

```powershell
pnpm run typecheck
pnpm run test
pnpm run test:build-web
python -m pytest pipeline/tests -q
git diff --check
```

Regenerate the copy corpus, public manifest/diff/privacy scan and local public-candidate commit when their inputs changed. Do not rerun Plain Language, Claude Scrubber, the local reviewer or the panel. A repair that adds or alters student-facing wording requires Peter's direction because the once-only language gates would no longer describe the final corpus.

- [ ] **Step 5: Commit and record the final candidate SHA**

```powershell
git status --short
git diff --check
git rev-parse HEAD
```

Commit accepted repairs and evidence once. Require a clean authoritative worktree and a clean local public-candidate worktree.

---

### Task 6: Apply and verify the narrow shared-Supabase change

**Files:**
- Read: `docs/operations/advertising-game-image-lab-allowances.sql`
- Read: `docs/operations/advertising-game-account-progress.sql`
- Read: `docs/operations/image-lab.md`
- Read: `docs/operations/advertising-game-account-progress.md`
- Read: `supabase/functions/advertising-game-backend/handler.ts`
- Create: `reviews/supabase-admarket-allowance-application-2026-07-27.md`

**Interfaces:**

- Shared project: `jftpeajvpqmxabuscoml`.
- Reserved scope: only the explicit Advertising Market Game allowance, reservation and audit objects named by the reviewed SQL.
- Forbidden scope: every object whose schema, table, function, policy, trigger or storage name belongs to `signal_lost`.

- [ ] **Step 1: Re-read current Supabase documentation and inspect live state read-only**

Before mutation, confirm current migration guidance, Auth admin password semantics, private-schema/RLS guidance and security advisors. Inspect existing schemas, functions, policies and migration records. Record the exact objects that will be created or altered.

- [ ] **Step 2: Announce and reserve the narrow mutation window**

Send the explicit coordination message required by the project:

```text
RESERVE: Advertising Market Game only — named Image Lab allowance, reservation and audit objects in jftpeajvpqmxabuscoml. No signal_lost object. Window begins now; verify and release immediately after application.
```

Do not proceed if another lane reports an overlapping reservation.

- [ ] **Step 3: Apply the reviewed idempotent SQL once**

Use the connected Supabase project tool against `jftpeajvpqmxabuscoml`. Apply only the exact reviewed statement. Do not use dashboard copy/paste, a service-role key on a command line, or an untracked SQL variation.

- [ ] **Step 4: Verify object shape and access boundaries**

Require:

- expected private tables/functions/policies exist;
- public and anonymous roles cannot read or mutate the ledger;
- service-only broker operations succeed through deterministic non-paid probes;
- repeated reservation IDs return the same reservation;
- debit/refund terminal transitions are idempotent;
- no `signal_lost` object, policy or migration changed;
- security advisors show no new relevant error.

Do not create a real student account, provider job or paid Image Lab request.

- [ ] **Step 5: Release immediately and retain sanitised evidence**

Send:

```text
RELEASE: Advertising Market Game allowance migration applied and verified; named reservation released. No signal_lost object touched.
```

Record object names, statement hash, verification queries and advisor outcome in `reviews/supabase-admarket-allowance-application-2026-07-27.md`. Include no secret or personal data.

---

### Task 7: Publish the reviewed public-source update and obtain the Linux release artifact

**Files:**
- Read: local public-candidate checkout from Task 3/5
- Read: `.github/workflows/build-and-publish.yml`
- Read: `docs/operations/release-workflow.md`
- Create: a new retained downloaded-artifact directory under `C:\tmp`

**Interfaces:**

- Public source target: `peterellisteacher-code/advertising-market-game`, branch `main`.
- Workflow: `Build & Validate Web`.
- Expected artifact: `advertising-market-game-web`.
- Deployment authority: none in the GitHub workflow; `permissions: contents: read`.

- [ ] **Step 1: Re-prove the public candidate immediately before push**

```powershell
git status --short
git diff --check
git rev-parse HEAD
```

Require the public commit content to match the reviewed public-snapshot manifest byte-for-byte. Reuse Task 3's clean-install results because the public commit and lockfile are unchanged; do not repeat the same full suite. Confirm the workflow has no deploy step, secret reference, write permission or unpinned action.

- [ ] **Step 2: Push the exact reviewed public commit**

Push only the local public-candidate `main` commit to the existing public repository. Do not change repository visibility, settings, branch protection, secrets, variables, Actions permissions or another repository.

- [ ] **Step 3: Verify the GitHub Actions run**

Read the run attached to the exact public commit. Require:

- Python catalogue tests pass;
- TypeScript passes;
- serialized Vitest passes with exact file/test counts;
- web-build contracts pass;
- Godot tests pass in the pinned Linux container;
- Godot web export succeeds;
- complete artifact assembly succeeds;
- `WEB_EXPORT_STATIC_VERIFICATION_OK`;
- no deploy job exists.

If CreateArtifact fails for storage quota, retain the successful job evidence and stop at that external boundary. Do not delete artifacts or repositories and do not change visibility or billing.

- [ ] **Step 4: Download once and verify the exact artifact**

Create a fresh unique retained directory. Download `advertising-market-game-web` once, retain the returned artifact URL/ID, and poll a yielded download instead of starting another.

```powershell
$publicShortSha = (git -C $publicCandidatePath rev-parse --short=12 HEAD).Trim()
$releaseRoot = "C:\tmp\admarket-release-$publicShortSha"
if (Test-Path -LiteralPath $releaseRoot) { throw "Fresh release path already exists" }
$artifactPath = Join-Path $releaseRoot "artifact"
New-Item -ItemType Directory -Path $artifactPath | Out-Null
node scripts/verify-web-export.mjs $artifactPath
```

Record archive SHA-256, release ID, static/function/asset counts, core precache entries, service-worker bytes and manifest hashes. Treat the downloaded artifact as immutable.

---

### Task 8: Create the deterministic unprotected QA draft

**Files:**
- Read: immutable downloaded artifact from Task 7
- Read: `C:\Users\Peter Ellis\.codex\skills\netlify-browser-qa\SKILL.md`
- Read: current installed `netlify:netlify-cli-and-deploy` skill
- Create: a fresh retained QA assembly directory under `C:\tmp`
- Create: deterministic QA Function and fake-state fixtures only inside that QA directory

**Interfaces:**

- QA project: `codex-browser-qa-harness`, ID `8edde91e-88ad-4a96-a49b-ddb8470d27c0`.
- Production site ID `fffc6f57-3fd2-44e3-9247-05a5f746351d` is forbidden for this task.
- Draft context: non-production deploy preview, no production alias and no visitor gate.
- Fake identity: aliases only; no student name or real credential.

- [ ] **Step 1: Confirm the QA project read-only before assembly**

Through the connected Netlify account, require:

- correct project ID;
- no custom/production domain alias;
- no visitor gate;
- no secrets or inherited production variables;
- no extension;
- no active production deployment target used by this task.

Do not change access controls.

- [ ] **Step 2: Create a new QA assembly and bind the exact static bytes**

Create a unique directory and fail if it exists. Copy the immutable artifact's static files byte-for-byte. Re-run `verify-web-export.mjs` before adding the QA-only routing layer. Record the static-tree manifest and prove every static byte remains equal afterwards.

- [ ] **Step 3: Add only deterministic fake QA endpoints**

The stub may implement only the account, progress, teacher and Image Lab state needed for the named UI replay. It must:

- use fixed aliases and generated fake state;
- never enumerate environment variables;
- make no outbound request;
- contain no Supabase/provider/production URL or key;
- perform no paid operation;
- reset only its deterministic QA state;
- return bounded typed errors for offline/error checks.

Label all resulting evidence as stubbed UI-to-API contract evidence. Do not include the production Function bundle in the QA project.

- [ ] **Step 4: Deploy one non-production draft**

Use the connector-returned QA project ID. If local artifact upload is unavailable through the connector, use the already-authenticated Netlify CLI without extracting or passing its token. Deploy as a draft only. Record project ID, deploy ID, unique URL, context, `published_at`, function list, edge-function list and readiness state.

Require `published_at: null`, no production alias, exactly the expected deterministic QA Function set and zero Edge Functions.

- [ ] **Step 5: Check the hosted draft read-only**

Require HTTP `200` for `/student`, `/teacher`, release manifest and service worker. Confirm there is no visitor password page. Confirm the release ID equals Task 7 and the QA Function identifies only fake state.

---

### Task 9: Complete current browser, visual, input and offline QA

**Files:**
- Read: current installed `browser:control-in-app-browser` skill immediately before browser use
- Read: `C:\Users\Peter Ellis\.codex\plugins\cache\openai-curated-remote\game-studio\0.1.2\skills\game-playtest\SKILL.md`
- Read: `C:\Users\Peter Ellis\.codex\plugins\cache\openai-curated-remote\game-studio\0.1.2\skills\game-ui-frontend\SKILL.md`
- Read: `C:\Users\Peter Ellis\.codex\plugins\cache\openai-curated-remote\game-studio\0.1.2\references\playtest-checklist.md`
- Create: screenshots and a neutral transcript under the retained QA directory
- Modify: `reviews/claude-playtest-2026-07-24-closure.md`

**Interfaces:**

- Viewports: exactly `1280x800`, exactly `1440x900`, and narrow `768x900`.
- Browser surface: the current in-app browser skill only.
- Console evidence: entries must be filtered by the current QA URL.
- Visual pass: judge text hierarchy, line length, grouping, whitespace, playfield protection and control disclosure, not merely DOM presence.

- [ ] **Step 1: Initialise the current browser skill once**

Read the currently installed versioned browser-control skill completely and resolve its current runtime paths. Close or ignore the protected production/draft tab. Do not ask Peter for a visitor password.

If browser initialisation or binding fails, make at most one clean reconnection through the skill's documented recovery. On a second tool-layer failure, stop browser actions and report the exact sanitised evidence. Do not substitute standalone Playwright or restart already completed checks.

- [ ] **Step 2: Verify the student route at 1280x800**

Capture the complete sequence:

1. direct `/student` pair login;
2. sign out, reload remains signed out, and a different fake pair can sign in;
3. factual first-use instruction and permanent full reference;
4. Art Director and Strategist definitions, current role and swap;
5. all twelve starters across the required categories;
6. visible rendered socket contact;
7. genuinely large product placement;
8. split-pane pointer drag and proportional canvas/library resize;
9. split separator keyboard actions, visible focus and unchanged canvas coordinates;
10. visible selected-item Delete, Undo and protected-item refusal;
11. bounded Section Fill, Cancel, apply, Undo and reload persistence;
12. valid logo insertion plus explicit missing prerequisites;
13. Image Lab draft/final remaining-use presentation with no teacher code;
14. one-action-at-a-time AIDA and visual-technique guidance;
15. audience-led price, qualified AI guide, market route and proof point;
16. five-part final review, publication completion and market entry;
17. local autosave and deterministic fake cloud-state presentation.

- [ ] **Step 3: Repeat layout-critical states at 1440x900**

Capture:

- opening/instruction layout;
- starter/product split;
- expanded and contracted split positions;
- Section Fill and logo states;
- final review and teacher/account controls;
- market view.

Require zero horizontal overflow, overlap, clipping, orphaned text, ambiguous primary action, unexplained dead space or console error.

- [ ] **Step 4: Verify the narrow 768x900 fallback**

Require explicit `Browse` and `Edit` tabs, no inaccessible resize separator, no floating `Hide library` overlay, no canvas obstruction, no clipped action and a logical keyboard order.

- [ ] **Step 5: Verify the teacher route**

Using the QA-only fake state:

1. `/teacher` displays its independent password gate;
2. `!Y10English!` opens the teacher dashboard;
3. student controls are absent before teacher authentication;
4. typed pair password creation works;
5. optional generated password, reveal and copy remain secondary;
6. password replacement visibly invalidates the fake pair session;
7. selected-pair reset requires the exact username and preserves its username/password;
8. teacher playtest is isolated from pair data;
9. factory reset requires exact `RESET`;
10. global/default/per-pair/batch Image Lab allocation controls update deterministic state;
11. `/student` never renders teacher controls.

Do not use a real account or persist any personal data.

- [ ] **Step 6: Verify service-worker and offline truthfulness where supported**

Require:

- the QA page is controlled after the expected first reload;
- verified static assets reload from cache under browser-emulated offline mode;
- account and teacher mutations report offline failure and never claim success;
- `/teacher` and `/student` route separation is not bypassed by a stale shell.

If the current browser skill cannot emulate offline mode, mark the browser-controlled offline reload unmeasured and retain the deterministic service-worker/cache contracts. Do not substitute another browser instrument.

- [ ] **Step 7: Run the visual-composition audit**

At every captured viewport inspect:

- heading/body hierarchy and readable line lengths;
- instruction grouping into discrete `Now`, `Why`, `Done`, `Next` elements;
- professional sentence case instead of all-caps paragraph labels;
- related controls grouped and unrelated controls separated;
- adequate whitespace without a large unused void;
- library/teacher panels do not dominate the product or game playfield;
- focus ring, disabled-state explanation and button purpose are visible;
- no floating control covers changing content.

Record each observation neutrally. A screenshot is required for every visual claim.

- [ ] **Step 8: Check console/network evidence and stop helpers**

Require zero warning/error entries owned by the current QA URL, excluding only documented browser/Godot informational messages. Confirm requests stay within the QA project and no Supabase, production Function or paid-provider origin is contacted.

Stop every local helper and confirm termination. The Netlify draft remains; retain the QA directory and screenshots. Delete nothing.

- [ ] **Step 9: Resolve substantiated browser defects as one integrated repair**

If the completed pass finds no real defect, record that result and continue. If it
does:

1. collect all findings before editing;
2. state the reference surface and falsifier for each;
3. write focused failing regressions;
4. make only substantiated, in-scope repairs;
5. run affected checks, then the final serialized suite once on the integrated state;
6. update any affected operator guide;
7. regenerate the copy hash, public manifest/diff/privacy scan and candidate SHAs;
8. sync and push one replacement public commit;
9. require a new passing Linux CI run and verify its immutable downloaded artifact;
10. deploy one replacement non-production QA draft; and
11. repeat only the affected browser checks at every viewport they can affect.

Do not rerun Plain Language, Claude Scrubber, the source reviewer or the coding
panel. If a defect requires new student-facing wording that is not an exact
already-accepted model response, stop and ask Peter rather than bypassing the
once-only language gates. If a repair materially changes authentication,
authorisation, migration semantics, paid-job idempotency, the public-snapshot
boundary or workflow execution, stop and ask Peter because the one-pass review
would no longer describe the release candidate. Do not overwrite or delete the
superseded artifact, draft evidence or screenshots.

- [ ] **Step 10: Close the Claude finding table**

Update every browser-dependent row in `reviews/claude-playtest-2026-07-24-closure.md` with exact screenshot/transcript evidence. Do not mark Safari, school wifi, real Supabase or production-hosted behaviour as measured.

---

### Task 10: Create the final verification record and stop before production

**Files:**
- Read: `docs/operations/release-workflow.md`
- Read: `docs/operations/advertising-game-account-progress.md`
- Read: `docs/operations/image-lab.md`
- Create: `docs/operations/release-verification-2026-07-27-student-teacher-editor-completion.md`
- Modify: `reviews/claude-playtest-2026-07-24-closure.md`

- [ ] **Step 1: Verify the released operator documentation**

Confirm the already-reviewed and publicly mirrored guides accurately document:

- student URL `/student`;
- teacher URL `/teacher`;
- teacher password configuration and session boundary without exposing any HMAC secret;
- typed/generated/replaced pair passwords;
- pair reset and isolated teacher factory reset confirmation words;
- Image Lab global/default/per-pair/batch allowance semantics;
- uncertain reservation handling;
- migration object names and rollback/operator observations;
- production deployment remains a separate explicit action.

If browser evidence exposed a documentation mismatch, include its correction in
Task 9's integrated repair and regenerate the public candidate before producing
the replacement artifact. Do not make a private-only operations correction after
the public artifact is fixed.

- [ ] **Step 2: Run the final evidence-before-completion gate**

Read `superpowers:verification-before-completion` again. Confirm that every cited command actually ran on the final unchanged SHA. Re-run only a gate whose input changed after its evidence was captured.

Bind retained results to current state with:

```powershell
git rev-parse HEAD
git status --short
git diff --check
Get-FileHash -Algorithm SHA256 reviews/student-copy-language-gate-2026-07-27.md
Get-FileHash -Algorithm SHA256 reviews/public-snapshot-manifest-2026-07-27.txt
node scripts/verify-web-export.mjs $artifactPath
```

Read the complete retained TypeScript, serialized Vitest, build-contract, Python and clean-public-snapshot logs and confirm their recorded SHA equals the current candidate/public commit. The Godot test/export, artifact assembly and verifier evidence must come from the exact final public commit and downloaded artifact. If any source, test, lockfile, build script, SQL or copy input changed after a cited run, rerun its owning gate; run the final serialized suite once on that changed state.

- [ ] **Step 3: Write the final record**

Record:

- authoritative pre-change and final SHAs;
- changed source groups;
- Plain Language and Claude Scrubber input/output/final hashes and adjudication;
- focused, full-suite, build-contract, Python and Godot counts;
- exact public commit, workflow run, artifact ID/archive hash and release manifest;
- public-snapshot manifest/diff/privacy/licence results;
- Supabase statement hash, named objects and verification outcome;
- code-review and five-model panel findings/resolutions/generation IDs;
- QA project ID, draft deploy ID/URL/context/function boundary;
- exact `1280x800`, `1440x900` and `768x900` screenshot paths;
- student, teacher, editor, service-worker, console and visual findings;
- helper-process termination and retained temp paths;
- Safari/student-Mac, school-wifi, real hosted Supabase, visitor-gate, edge-limit/header and production uncertainties;
- confirmation that production, its visitor gate, site aliases and production secrets are unchanged.

- [ ] **Step 4: Commit the private verification record**

```powershell
git add -- docs/operations/release-verification-2026-07-27-student-teacher-editor-completion.md reviews/claude-playtest-2026-07-24-closure.md reviews/release-readiness-code-review-2026-07-27.md reviews/release-readiness-coding-panel-2026-07-27.json reviews/release-readiness-review-bundle-2026-07-27.md reviews/supabase-admarket-allowance-application-2026-07-27.md
git diff --cached --check
git commit -m "docs(release): verify student teacher and editor completion"
git status --short
```

Inspect the staged list before commit. Do not stage unrelated or Claude-owned files.

- [ ] **Step 5: Report the non-production handoff**

Give Peter:

- student and teacher draft links;
- QA project ID and draft deploy ID;
- exact candidate/public/artifact/release identities;
- concise changed-source groups;
- test/build/browser results;
- exact screenshot/evidence paths;
- current review findings and their bounded resolutions;
- Supabase change scope;
- remaining Safari/school-wifi/real-hosted uncertainties;
- explicit confirmation that production was not deployed or otherwise changed.

Stop. Do not deploy production until Peter has reviewed the draft and explicitly authorises that separate action.

---

## Plan Completion Gate

- [ ] The complete final corpus passed one Plain Language call followed by one deterministic all-sections MICROCOPY pass, with every section diff-guarded and no local stylistic rewrite.
- [ ] Focused checks, TypeScript, serialized Vitest, build contracts and Python catalogue tests pass on the final unchanged candidate.
- [ ] The curated public snapshot has an exact manifest/diff, contains every required input, contains no private litter or credential and builds from a clean install.
- [ ] Exactly one fresh Superpowers code review and one five-model coding panel ran against the same neutral stable evidence.
- [ ] Every genuine Critical or Important finding was resolved once; no reviewer loop ran.
- [ ] The narrow Supabase change touched only the named Advertising objects and the shared-project reservation was released.
- [ ] The exact final public commit passed the pinned Linux Godot test/export and complete artifact workflow.
- [ ] The downloaded artifact passed `verify-web-export.mjs` unchanged.
- [ ] One unprotected non-production QA draft contains exact static bytes plus only deterministic fake endpoints.
- [ ] Current browser evidence covers student, teacher and editor journeys at 1280x800, 1440x900 and 768x900.
- [ ] Visual evidence shows clear hierarchy, good grouping, protected playfield, no floating obstruction and no overflow, clipping, orphaned text, ambiguous action or unexplained dead space.
- [ ] Service-worker control and offline truthfulness are either observed through the current browser skill or explicitly retained as an unmeasured browser limitation with deterministic contract evidence.
- [ ] All actionable Claude findings have focused or current browser evidence.
- [ ] The final operations and verification records identify every measured and unmeasured boundary.
- [ ] Production, its visitor gate, aliases, secrets and deployed version remain unchanged.

## Cross-Plan Acceptance Map

| Approved criterion | Owning implementation task | Terminal evidence task |
| --- | --- | --- |
| 1. Public student route, no teacher controls | Access Tasks 1 and 7 | Verification Task 9 |
| 2. Protected teacher route | Access Tasks 1, 2 and 5 | Verification Task 9 |
| 3. Typed and replaced pair passwords | Access Tasks 3, 4 and 5 | Verification Tasks 4 and 9 |
| 4. Isolated resettable teacher playtest | Access Task 6 | Verification Task 9 |
| 5. Selected-pair reset preserves credentials | Access Tasks 4 and 5 | Verification Task 9 |
| 6. Server-side Image Lab allowances | Image Lab Tasks 1–7 | Verification Tasks 4, 6 and 9 |
| 7. No student teacher code | Image Lab Tasks 3–5 | Verification Task 9 |
| 8. Twelve varied starters | Editor Task 1 | Verification Tasks 2 and 9 |
| 9. Rendered socket alignment | Editor Task 2 | Verification Tasks 2 and 9 |
| 10. Visible undoable deletion | Editor Task 4 | Verification Task 9 |
| 11. Pointer/keyboard proportional split | Editor Task 3 | Verification Task 9 |
| 12. Independent bounded Section Fill | Editor Tasks 1, 5 and 6 | Verification Task 9 |
| 13. Reliable logo insertion | Editor Task 7 | Verification Task 9 |
| 14. Explained partner roles | Guidance Task 2 | Verification Task 9 |
| 15. Linked one-action instructions | Guidance Tasks 1 and 3 | Verification Tasks 1 and 9 |
| 16. Reload-stable market completion | Guidance Tasks 4 and 6 | Verification Task 9 |
| 17. Reused-device handover | Access Task 7 | Verification Task 9 |
| 18. Claude finding closure | Guidance Tasks 4–8 | Verification Tasks 9 and 10 |
| 19. Objective language gates | Guidance Task 7 | Verification Task 1 |
| 20. Full deterministic, review and browser gates | All implementation plans | Verification Tasks 2–9 |
| 21. Current operations guide | Verification Task 2 | Verification Task 10 |
| 22. Controlled external changes | All global constraints | Verification Tasks 3–10 |
