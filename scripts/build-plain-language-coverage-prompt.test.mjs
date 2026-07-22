import assert from "node:assert/strict";
import test from "node:test";

import { formatCoveragePrompt } from "./build-plain-language-coverage-prompt.mjs";

test("formats one coverage question with the full flow and every mapped copy entry", () => {
  const prompt = formatCoveragePrompt({
    flow: "1. Start now.\n2. Swap roles.",
    entries: [
      { id: "COPY__L0001__N01", text: "Choose a product." },
      { id: "COPY__L0002__N01", text: "Finish shopping." },
    ],
  });

  assert.match(prompt, /small, progressively revealed actions/);
  assert.match(prompt, /start immediately/);
  assert.match(prompt, /roles, progress, and what “done” means/);
  assert.match(prompt, /1\. Start now\.\n2\. Swap roles\./);
  assert.match(prompt, /\[COPY__L0001__N01\] Choose a product\./);
  assert.match(prompt, /\[COPY__L0002__N01\] Finish shopping\./);
  assert.equal((prompt.match(/\[COPY__/g) ?? []).length, 2);
});
