import { describe, expect, it } from "vitest";
import {
  MARKET_COOKIE,
  createMarketSessionToken,
  deriveMarketRoomCode,
  deriveMarketSessionIntentKey,
  generateRoomCode,
  parseMarketEnvironment,
  readMarketCookie,
  readMarketRequestSession,
  readMarketSessionToken,
  secureMarketCodeMatches,
  serialiseMarketCookie
} from "./market-auth";

const secret = "s".repeat(32);

describe("market environment", () => {
  it("fails closed unless both classroom code and signing secret are bounded", () => {
    expect(parseMarketEnvironment({})).toEqual({ enabled: false });
    expect(parseMarketEnvironment({
      MARKET_CLASSROOM_CODE: "short",
      MARKET_SIGNING_SECRET: secret
    })).toEqual({ enabled: false });
    expect(parseMarketEnvironment({
      MARKET_CLASSROOM_CODE: "CLASS-2026",
      MARKET_SIGNING_SECRET: secret
    })).toEqual({
      enabled: true,
      classroomCode: "CLASS-2026",
      signingSecret: secret
    });
  });

  it("compares classroom codes without accepting a different-length candidate", () => {
    expect(secureMarketCodeMatches("CLASS-2026", "CLASS-2026")).toBe(true);
    expect(secureMarketCodeMatches("CLASS-202", "CLASS-2026")).toBe(false);
    expect(secureMarketCodeMatches("CLASS-2027", "CLASS-2026")).toBe(false);
  });

  it("matches the classroom-code request bound without shrinking the signing-secret bound", () => {
    expect(parseMarketEnvironment({
      MARKET_CLASSROOM_CODE: "C".repeat(128),
      MARKET_SIGNING_SECRET: "s".repeat(4_096)
    })).toMatchObject({ enabled: true });
    expect(parseMarketEnvironment({
      MARKET_CLASSROOM_CODE: "C".repeat(129),
      MARKET_SIGNING_SECRET: secret
    })).toEqual({ enabled: false });
    expect(parseMarketEnvironment({
      MARKET_CLASSROOM_CODE: "CLASS-2026",
      MARKET_SIGNING_SECRET: "s".repeat(4_097)
    })).toEqual({ enabled: false });
  });
});

describe("market room and session tokens", () => {
  it("generates a six-character non-ambiguous room code", () => {
    expect(generateRoomCode(Uint8Array.from([0, 1, 8, 23, 30, 31]))).toMatch(
      /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/
    );
    expect(generateRoomCode(Uint8Array.from([0, 1, 8, 23, 30, 31]))).not.toMatch(/[01IO]/);
  });

  it("derives stable domain-separated room codes for the eight create attempts", () => {
    const intentKey = "a".repeat(64);

    expect(deriveMarketRoomCode(secret, intentKey, 0)).toBe("BX3-V7D");
    expect(deriveMarketRoomCode(secret, intentKey, 1)).toBe("VGU-WMY");
    expect(deriveMarketRoomCode("t".repeat(32), intentKey, 0)).not.toBe("BX3-V7D");
    expect(() => deriveMarketRoomCode(secret, intentKey, 8)).toThrow();
    expect(() => deriveMarketRoomCode(secret, "not-a-hash", 0)).toThrow();
  });

  it("derives distinct stable intent keys for create and join operations", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const operationId = "22222222-2222-4222-8222-222222222222";

    expect(deriveMarketSessionIntentKey("create", clientId, operationId)).toBe(
      "6a34314cd04b81a2fb4740935859098d2f2a60f04437e1a90ccd0a0949050fd4"
    );
    expect(deriveMarketSessionIntentKey("join", clientId, operationId)).toBe(
      "6876c7a0c0c978c3c132a2da2e2c248109866e4c45ffc01110aa7543c0036764"
    );
  });

  it("round-trips bounded teacher and team identities and rejects tampering or expiry", () => {
    const teacher = createMarketSessionToken({
      role: "teacher",
      roomCode: "ABC-234",
      expiresAt: 2_000
    }, secret);
    expect(readMarketSessionToken(teacher, secret, 1_500)).toEqual({
      version: 1,
      role: "teacher",
      roomCode: "ABC-234",
      expiresAt: 2_000
    });

    const team = createMarketSessionToken({
      role: "team",
      roomCode: "ABC-234",
      teamId: "team-1",
      expiresAt: 2_000
    }, secret);
    expect(readMarketSessionToken(team, secret, 1_500)).toMatchObject({
      role: "team",
      teamId: "team-1"
    });
    expect(() => readMarketSessionToken(`${team.slice(0, -1)}x`, secret, 1_500))
      .toThrow(expect.objectContaining({ code: "INVALID_SESSION" }));
    expect(() => readMarketSessionToken(team, secret, 2_000))
      .toThrow(expect.objectContaining({ code: "SESSION_EXPIRED" }));
  });

  it("uses an HttpOnly SameSite=Strict room-scoped cookie and parses it from requests", () => {
    const token = createMarketSessionToken({
      role: "teacher",
      roomCode: "ABC-234",
      expiresAt: 2_000
    }, secret);
    expect(serialiseMarketCookie(token, 500, true)).toBe(
      `${MARKET_COOKIE}=${token}; Path=/api/market; HttpOnly; SameSite=Strict; Max-Age=500; Secure`
    );
    expect(readMarketCookie(new Request("https://example.test/api/market/snapshot", {
      headers: { cookie: `other=1; ${MARKET_COOKIE}=${token}; last=2` }
    }))).toBe(token);
    expect(readMarketCookie(new Request("https://example.test/api/market/snapshot"))).toBeNull();
  });

  it("prefers a supplied bearer and never falls back to a valid cookie when it is invalid", () => {
    const teacher = createMarketSessionToken({
      role: "teacher",
      roomCode: "ABC-234",
      expiresAt: 2_000
    }, secret);
    const team = createMarketSessionToken({
      role: "team",
      roomCode: "ABC-234",
      teamId: "team-1",
      expiresAt: 2_000
    }, secret);
    const withCookie = (authorization?: string): Request => new Request(
      "https://example.test/api/market/snapshot",
      { headers: {
        cookie: `${MARKET_COOKIE}=${teacher}`,
        ...(authorization === undefined ? {} : { authorization })
      } }
    );

    expect(readMarketRequestSession(withCookie(`Bearer ${team}`), secret, 1_500))
      .toMatchObject({ role: "team", teamId: "team-1" });
    expect(readMarketRequestSession(withCookie(), secret, 1_500))
      .toMatchObject({ role: "teacher" });
    expect(readMarketRequestSession(new Request(
      "https://example.test/api/market/snapshot"
    ), secret, 1_500)).toBeNull();

    for (const authorization of [
      "Basic abc",
      "Bearer malformed",
      `Bearer ${team.slice(0, -1)}x`
    ]) {
      expect(() => readMarketRequestSession(withCookie(authorization), secret, 1_500))
        .toThrow(expect.objectContaining({ code: "INVALID_SESSION" }));
    }
    expect(() => readMarketRequestSession(withCookie(`Bearer ${team}`), secret, 2_000))
      .toThrow(expect.objectContaining({ code: "SESSION_EXPIRED" }));
  });
});
