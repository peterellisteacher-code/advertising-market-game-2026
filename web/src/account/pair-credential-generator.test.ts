import { describe, expect, it, vi } from "vitest";

import { generateStrongPairPassword } from "./pair-credential-generator";

describe("pair credential generator", () => {
  it("creates a copyable 20-character password with strong mixed character classes", () => {
    let next = 0;
    const randomValues = vi.fn((target: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => {
      for (let index = 0; index < target.length; index += 1) {
        target[index] = next % 240;
        next += 17;
      }
      return target;
    });

    const password = generateStrongPairPassword(randomValues);

    expect(password).toHaveLength(20);
    expect(password).toMatch(/[A-Z]/u);
    expect(password).toMatch(/[a-z]/u);
    expect(password).toMatch(/[2-9]/u);
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]+$/u);
    expect(password).not.toMatch(/[0OIl1]/u);
    expect(randomValues).toHaveBeenCalled();
  });

  it("fails closed when secure browser randomness is unavailable", () => {
    expect(() => generateStrongPairPassword(undefined, {} as Crypto)).toThrow(
      "Secure password generation is unavailable"
    );
  });
});
