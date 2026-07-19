import { describe, expect, it } from "vitest";
import {
  createJoinOperationId,
  isJoinOperationIdForRoom
} from "../../../shared/market-operation-id";

const ENTROPY_UUID = "00112233-4455-4677-8899-aabbccddeeff";

describe("market operation ids", () => {
  it("encodes and validates all six room alphabet indices in a UUIDv8", () => {
    const operationId = createJoinOperationId("ABC-234", () => ENTROPY_UUID);

    expect(operationId).toBe("4254008b-4455-8677-8899-aabbccddeeff");
    expect(isJoinOperationIdForRoom(operationId, "ABC-234")).toBe(true);
    expect(isJoinOperationIdForRoom(operationId, "ABC-235")).toBe(false);
  });

  it.each(["222-222", "ABC-234", "ZZZ-ZZZ"])(
    "round-trips room scope %s",
    (roomCode) => {
      const operationId = createJoinOperationId(roomCode, () => ENTROPY_UUID);
      expect(isJoinOperationIdForRoom(operationId, roomCode)).toBe(true);
    }
  );

  it("preserves exactly the remaining 92 entropy bits with RFC version and variant bits", () => {
    const operationId = createJoinOperationId("ABC-234", () => ENTROPY_UUID);
    const entropy = ENTROPY_UUID.replaceAll("-", "");
    const encoded = operationId.replaceAll("-", "");
    const fixedBits = new Set<number>([
      ...Array.from({ length: 30 }, (_value, bit) => bit),
      48, 49, 50, 51,
      64, 65
    ]);
    let retained = 0;
    for (let bit = 0; bit < 128; bit += 1) {
      if (fixedBits.has(bit)) continue;
      const nibble = Math.floor(bit / 4);
      const shift = 3 - (bit % 4);
      expect((Number.parseInt(encoded[nibble]!, 16) >> shift) & 1).toBe(
        (Number.parseInt(entropy[nibble]!, 16) >> shift) & 1
      );
      retained += 1;
    }
    expect(retained).toBe(92);
    expect(operationId[14]).toBe("8");
    expect(["8", "9", "a", "b"]).toContain(operationId[19]);
  });

  it.each([
    "",
    "not-a-uuid",
    "00112233-4455-4677-8899-aabbccddeeff",
    "4254008b-4455-7677-8899-aabbccddeeff",
    "4254008b-4455-8677-0899-aabbccddeeff"
  ])("rejects malformed or non-v8 join operation id %s", (operationId) => {
    expect(isJoinOperationIdForRoom(operationId, "ABC-234")).toBe(false);
  });

  it("rejects malformed room codes and entropy UUIDs", () => {
    expect(() => createJoinOperationId("ABC234", () => ENTROPY_UUID)).toThrow(RangeError);
    expect(() => createJoinOperationId("ABC-23I", () => ENTROPY_UUID)).toThrow(RangeError);
    expect(() => createJoinOperationId("ABC-234", () => "not-a-uuid")).toThrow(Error);
    expect(isJoinOperationIdForRoom(
      "4254008b-4455-8677-8899-aabbccddeeff",
      "abc-234"
    )).toBe(false);
  });
});
