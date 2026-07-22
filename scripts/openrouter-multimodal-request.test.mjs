import assert from "node:assert/strict";
import test from "node:test";

import { buildChatPayload, mimeTypeForPath } from "./openrouter-multimodal-request.mjs";

test("builds genuine multipart image input with text first", () => {
  const payload = buildChatPayload({
    model: "example/model",
    prompt: "Review this.",
    images: [
      { mimeType: "image/png", base64: "AAA=" },
      { mimeType: "image/jpeg", base64: "BBB=" },
    ],
    maxTokens: 1200,
  });
  assert.equal(payload.model, "example/model");
  assert.equal(payload.max_tokens, 1200);
  assert.deepEqual(payload.messages[0].content, [
    { type: "text", text: "Review this." },
    { type: "image_url", image_url: { url: "data:image/png;base64,AAA=" } },
    { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBB=" } },
  ]);
});

test("keeps a text-only request text-only", () => {
  const payload = buildChatPayload({ model: "example/model", prompt: "Review code.", images: [] });
  assert.equal(payload.messages[0].content, "Review code.");
  assert.equal("max_tokens" in payload, false);
});

test("accepts OpenRouter image formats and rejects unknown extensions", () => {
  assert.equal(mimeTypeForPath("screen.png"), "image/png");
  assert.equal(mimeTypeForPath("screen.JPG"), "image/jpeg");
  assert.equal(mimeTypeForPath("screen.webp"), "image/webp");
  assert.equal(mimeTypeForPath("screen.gif"), "image/gif");
  assert.throws(() => mimeTypeForPath("screen.bmp"), /unsupported_image_type/);
});
