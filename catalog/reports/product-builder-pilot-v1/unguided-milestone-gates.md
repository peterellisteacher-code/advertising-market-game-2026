# Provisional Product-Builder Review Record

Date: 2026-07-14 (Australia/Adelaide)

## Status correction

These OpenRouter calls were independent and blind, but they do **not** constitute the formal project gates. A later clarification requires two distinct pre-established six-model families and explicitly adversarial as well as unguided prompts. The calls below used the visual family for both subjects and used neutral readiness prompts. Their findings remain useful exploratory evidence only.

The formal visual and coding gates must be rerun with their separate established families and adversarial, unguided prompts.

## Locked formal panel contract

The live OpenRouter catalogue was checked on 2026-07-14. The formal visual family is:

1. `mistralai/mistral-medium-3-5`
2. `stepfun/step-3.7-flash`
3. `google/gemini-3.1-pro-preview`
4. `xiaomi/mimo-v2.5`
5. `minimax/minimax-m3`
6. `moonshotai/kimi-k2.7-code`

The formal coding family is:

1. `deepseek/deepseek-v4-pro`
2. `z-ai/glm-5.2`
3. `moonshotai/kimi-k2.7-code`
4. `tencent/hy3`
5. `x-ai/grok-4.5`
6. `xiaomi/mimo-v2.5-pro`

Each OpenRouter gate consists of two blind passes. Each model receives the same immutable evidence for that pass and no rubric, suspected defect, prior finding, preferred verdict or other reviewer output. The sole review direction is to work adversarially and try to falsify readiness using only the supplied evidence. Every call uses `max_tokens: 32000`; pass 2 remains blind to pass 1.

Codensus is separate: one fresh local `gpt-5.6-sol` reviewer at `xhigh` with `fork_turns: none`, using one blind, unguided and adversarial pass under the Codensus skill contract.

## Exploratory method

Visual and coding reviews each ran as two blind passes. Every pass used the same raw evidence within its review, a different seed, and these six models in fixed order:

1. `moonshotai/kimi-k2.7-code`
2. `stepfun/step-3.7-flash`
3. `google/gemini-3.1-pro-preview`
4. `xiaomi/mimo-v2.5`
5. `minimax/minimax-m3`
6. `x-ai/grok-4.5`

Each call used `max_tokens: 32000` and `temperature: 0.1`. The prompts supplied neutral project context, raw evidence and a readiness question only. They supplied no checklist, suspected defect, prior finding or preferred verdict. Pass 2 was blind to pass 1. Earlier guided calls are exploratory and do not count toward these gates.

## Exploratory results

| Gate | Seed | Kimi | Step | Gemini | MiMo | MiniMax | Grok |
|---|---:|---|---|---|---|---|---|
| Visual pass 1 | 9411 | PROCEED | PROCEED | REVISE | PROCEED | PROCEED | PROCEED |
| Visual pass 2 | 9412 | PROCEED | PROCEED | REVISE | PROCEED | PROCEED | PROCEED |
| Coding pass 1 | 9413 | PROCEED | PROCEED | PROCEED | PROCEED | PROCEED | PROCEED |
| Coding pass 2 | 9414 | PROCEED | PROCEED | PROCEED | PROCEED | PROCEED | PROCEED |

Exploratory visual result: 10/12 PROCEED. Exploratory coding result: 12/12 PROCEED. Neither result is the formal OpenRouter gate.

Gemini's repeated visual dissent concerned sidebar density, the small internal scrollbar, prominent transform handles, the active Price tab during product design, and the right-panel hint. Those observations are visible, but none contradict the runtime evidence or block clipped artwork work. The 720p scroll is contained, the canvas and inspector remain usable, and the next milestone is the right place to tune artwork-specific controls and hints.

## Local Codensus

One fresh, read-only `gpt-5.6-sol` reviewer ran at `xhigh` with `fork_turns: none`. It received neutral evidence and no panel findings. Verdict: `PROCEED`.

Its useful forward requirement is retained: the clipped-artwork milestone must test clip persistence through serialization, transforms, duplication and export.

## Implementation decision

Automated and browser evidence supports continuing implementation into nested clipped artwork editing. Formal OpenRouter gate status remains pending. The next implementation must preserve the stable product selection frame and add its own artwork-level hit-testing and persistence tests.
