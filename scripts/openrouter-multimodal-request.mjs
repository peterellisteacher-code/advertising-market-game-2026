import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 40 * 1024 * 1024;

export function mimeTypeForPath(imagePath) {
  switch (path.extname(imagePath).toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    default: throw new Error(`unsupported_image_type:${imagePath}`);
  }
}

export function buildChatPayload({ model, prompt, images, maxTokens }) {
  const content = images.length === 0
    ? prompt
    : [
        { type: "text", text: prompt },
        ...images.map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        })),
      ];
  const payload = {
    model,
    messages: [{ role: "user", content }],
  };
  if (maxTokens !== undefined) payload.max_tokens = maxTokens;
  return payload;
}

function oneValue(flag) {
  const indexes = process.argv.flatMap((value, index) => value === flag ? [index] : []);
  if (indexes.length !== 1 || !process.argv[indexes[0] + 1]) throw new Error(`expected_one_${flag.slice(2)}`);
  return process.argv[indexes[0] + 1];
}

function optionalInteger(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`invalid_${flag.slice(2)}`);
  return value;
}

function repeatedValues(flag) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag) {
      if (!process.argv[index + 1]) throw new Error(`missing_${flag.slice(2)}`);
      values.push(process.argv[index + 1]);
    }
  }
  return values;
}

async function loadImages(paths) {
  let totalBytes = 0;
  const images = [];
  const manifest = [];
  for (const imagePath of paths) {
    const absolute = path.resolve(imagePath);
    const bytes = (await stat(absolute)).size;
    if (bytes > MAX_IMAGE_BYTES) throw new Error(`image_too_large:${absolute}:${bytes}`);
    totalBytes += bytes;
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) throw new Error(`images_too_large_total:${totalBytes}`);
    const buffer = await readFile(absolute);
    const mimeType = mimeTypeForPath(absolute);
    images.push({ mimeType, base64: buffer.toString("base64") });
    manifest.push({
      path: absolute,
      bytes,
      mime_type: mimeType,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    });
  }
  return { images, manifest };
}

async function main() {
  const model = oneValue("--model");
  const promptPath = path.resolve(oneValue("--prompt-file"));
  const outputPath = path.resolve(oneValue("--output-file"));
  const imagePaths = repeatedValues("--image");
  const maxTokens = optionalInteger("--max-tokens", undefined);
  const timeoutMs = optionalInteger("--timeout-ms", 840000);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY_not_set");

  const prompt = await readFile(promptPath, "utf8");
  const { images, manifest } = await loadImages(imagePaths);
  const payload = buildChatPayload({ model, prompt, images, maxTokens });
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://openai.com/codex/",
      "X-Title": "Codex adversarial review panel",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const responseText = await response.text();
  let responseBody;
  try {
    responseBody = JSON.parse(responseText);
  } catch {
    responseBody = { non_json_body: responseText.slice(0, 2000) };
  }
  const record = {
    request: {
      model,
      prompt_path: promptPath,
      prompt_bytes: Buffer.byteLength(prompt, "utf8"),
      prompt_sha256: createHash("sha256").update(prompt, "utf8").digest("hex"),
      images: manifest,
      max_tokens: maxTokens ?? null,
      timeout_ms: timeoutMs,
    },
    http_status: response.status,
    response: responseBody,
  };
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  if (!response.ok) throw new Error(`openrouter_http_${response.status}:${outputPath}`);
  const generationId = responseBody?.id ?? "unknown";
  const servedModel = responseBody?.model ?? "unknown";
  process.stdout.write(`OPENROUTER_REQUEST_OK id=${generationId} model=${servedModel} images=${images.length} output=${outputPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
