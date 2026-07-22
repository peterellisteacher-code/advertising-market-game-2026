# OpenRouter panel status

## Immutable evidence

- Prompt: `../openrouter-panel-prompt.txt`
- UTF-8 size: 78,639 bytes; 78,532 characters
- SHA-256: `36DB0737268F096A274B08715E0E6F1935E8CF8C3B368F85D24BCFC610FEC9FC`
- Copy entries: 903
- Transport supplied the same text-only message to every seat. No image bytes were sent, so visual claims are textual inferences rather than screenshot review.
- The computer crash interrupted the first transport attempt. Peter explicitly authorised one resend of the unchanged prompt. No post-timeout retry, fallback seat, replacement family, or judge model was used.

## Seats

| Intended seat | Resolved route | Status | Terminal result |
|---|---|---|---|
| `moonshotai/kimi-k3` | `moonshotai/kimi-k3-20260715` | Incomplete | MCP timeout after 300 seconds; no generation ID |
| `z-ai/glm-5.2` | `z-ai/glm-5.2-20260616` | Incomplete | MCP timeout after 300 seconds; no generation ID |
| `google/gemini-pro-latest` | `~google/gemini-pro-latest`; served `google/gemini-3.1-pro-preview-20260219` | Completed | `REVISE`; generation `gen-1784639172-CmzHzlpHkt2ERjWorvuF` |
| `x-ai/grok-4.5` | `x-ai/grok-4.5-20260708` | Completed | `FAIL`; generation `gen-1784639221-IYDwjfxbjn71ro3ermrP` |

Completed-generation metadata was rechecked through the read-only generation endpoint. Gemini used 31,436 native prompt tokens and 4,731 native completion tokens; Grok used 28,410 and 5,574. Their recorded costs were $0.11844756 and $0.089145936 respectively. No completion or billing status is claimed for the timed-out seats.

Raw terminal records are preserved beside this file:

- `kimi-k3-20260715.txt`
- `glm-5.2-20260616.txt`
- `gemini-pro-latest.txt`
- `grok-4.5-20260708.txt`
