# Coding consensus: clipped artwork checkpoint

Date: 2026-07-14
Evidence range: `2b260e5..7550f67`
Evidence package: 12 commits, 127,032 bytes
Fresh local baseline: 69 focused tests, TypeScript clean, full Vitest 424/424

## Fixed panel contract

Every model received the same neutral, blind, unguided, adversarial prompt and the same raw evidence. No suspected defect, prior finding, preferred verdict, word limit, stop sequence, or judge output was supplied. Temperature was 0.1, pass-one seed was 20260714, pass-two seed was 20260715, streaming was enabled, and every slot received `max_tokens: 32000`.

Coding roster:

1. `deepseek/deepseek-v4-pro`
2. `z-ai/glm-5.2`
3. `moonshotai/kimi-k2.7-code`
4. `tencent/hy3`
5. `x-ai/grok-4.5`
6. `xiaomi/mimo-v2.5-pro`

## Pass 1

| Model | Result |
|---|---|
| DeepSeek V4 Pro | Complete; REVISE |
| GLM 5.2 | Complete; PROCEED |
| Kimi K2.7 Code | Truncated at the model output ceiling; no usable verdict |
| HY3 | Complete; REVISE |
| Grok 4.5 | Complete; PROCEED |
| MiMo V2.5 Pro | Complete; PROCEED |

Usable vote: 3 PROCEED, 2 REVISE, 1 incomplete. Raw output is preserved in `.superpowers/sdd/coding-panel-pass-1.txt`.

## Pass 2

Pass 2 is incomplete and is not counted as a formal gate:

- the aggregate call timed out after 300 seconds;
- one identical aggregate retry timed out after 300 seconds;
- a final same-prompt per-model completion capture returned five timeouts and one gateway timeout stub;
- no model was substituted and no prompt, evidence, seed, or token ceiling was changed.

Raw status is preserved in `.superpowers/sdd/coding-panel-pass-2-status.txt`. No further retry loop was started.

## Primary verification of disputed claims

The two REVISE responses contained six claimed blockers. Five were falsified against the installed Fabric 7.4 source, the actual diff, and 82 focused tests:

- the no-op text guard is before mutation, not after it;
- `Textbox.set("text", value)` performs Fabric's dimension refresh;
- scene-to-group centring is correctly transformed by `Group.add()`;
- clip paths are deliberately excluded from semantic identity by contract;
- the factory explicitly sets `elementKind: "product-shell"`;
- semantic wrappers are not shared across exporter and draft clones, and nested `src` values are recursively checked at canvas load and publication.

One narrower issue was confirmed: long-to-short text edits remained at the smallest historical scale. The panel described this as multiplicative corruption; the actual defect was shrink-only, history-dependent non-regrowth.

Resolution:

- `05990ff` derives an absolute Textbox fit from unscaled, stroke-inclusive dimensions and intersects natural size, the existing 640×360 factory cap, and the 82% artwork-surface cap;
- direct placement, edit parity, long-to-short regrowth, Fabric round trip, clipping, identity, geometry, transforms, and no-op behavior are covered;
- `33884e6` closes the independent review's only minor mutation-count test gap.

Fresh post-fix verification: 17/17 focused, TypeScript clean, full Vitest 426/426. Independent review: APPROVED, follow-up CLOSED.

## Status

`PASS_1_REVIEWED_AND_ACTIONED; PASS_2_INCOMPLETE`

This is not recorded as a completed two-pass OpenRouter gate. Engineering work may continue because the only verified defect was fixed and independently reviewed. The next formal coding gate will use a smaller integrated evidence package after targeted catalogue placement and edit-mode lifecycle work; it must again run two blind passes with the fixed six-model roster.
