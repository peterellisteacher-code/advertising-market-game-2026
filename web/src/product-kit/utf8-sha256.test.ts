import { describe, expect, it } from "vitest";
import { sha256Utf8 } from "./utf8-sha256";

describe("sha256Utf8", () => {
  it.each([
    ["empty text", "", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "the standard multi-block message",
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    ],
    ["Unicode text", "广告市场🎨", "b4bf91488f8e0df669e309853821f5a3435c2338b0f7627146c94e75c6a2ef47"]
  ])("hashes %s as UTF-8", (_label, value, expected) => {
    expect(sha256Utf8(value)).toBe(expected);
  });

  it.each([
    ["a lone high surrogate", "\uD800"],
    ["a trailing high surrogate", "valid\uDFFF\uD800"],
    ["a high surrogate followed by a non-low code unit", "\uD800x"],
    ["a lone low surrogate", "\uDFFF"],
    ["a low surrogate after ordinary text", "valid\uDFFF"]
  ])("rejects %s instead of hashing a replacement character", (_label, value) => {
    expect(() => sha256Utf8(value)).toThrow(TypeError);
  });

  it("is deterministic without changing its input", () => {
    const value = "immutable input \uD83C\uDFA8";
    const before = value;

    const first = sha256Utf8(value);
    const second = sha256Utf8(value);

    expect(first).toBe(second);
    expect(value).toBe(before);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
