// @vitest-environment node

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TEACHER_SESSION_COOKIE,
  TeacherAuthError,
  clearTeacherCookie,
  createTeacherSessionToken,
  parseTeacherEnvironment,
  requireTeacherSession,
  secureTeacherPasswordMatches,
  serialiseTeacherCookie,
  verifyTeacherSessionToken,
  type TeacherSessionClaims
} from "./teacher-auth";

const secret = "s".repeat(48);
const claims = (overrides: Partial<TeacherSessionClaims> = {}): TeacherSessionClaims => ({
  schema: "ad-market-teacher-session",
  version: 1,
  issuedAt: 1_000,
  expiresAt: 2_000,
  nonce: "AQIDBAUGBwgJCgsMDQ4PEA",
  ...overrides
});

const signPayload = (payload: object): string => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encoded, "utf8")
    .digest("base64url");
  return `${encoded}.${signature}`;
};

describe("teacher authentication primitives", () => {
  it("round-trips one exact bounded HMAC session", () => {
    const token = createTeacherSessionToken(claims(), secret);

    expect(verifyTeacherSessionToken(token, secret, 1_500)).toEqual(claims());
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
  });

  it("rejects malformed, forged, expired, future and overlong sessions", () => {
    const valid = createTeacherSessionToken(claims(), secret);
    const [payload, signature] = valid.split(".") as [string, string];

    expect(verifyTeacherSessionToken(`${payload}.${signature.slice(0, -1)}A`, secret, 1_500))
      .toBeNull();
    expect(verifyTeacherSessionToken("not+base64.signature", secret, 1_500)).toBeNull();
    expect(verifyTeacherSessionToken(`${payload}=.${signature}`, secret, 1_500)).toBeNull();
    expect(verifyTeacherSessionToken(valid, secret, 2_000)).toBeNull();
    expect(verifyTeacherSessionToken(
      createTeacherSessionToken(claims({ issuedAt: 1_501 }), secret),
      secret,
      1_500
    )).toBeNull();
    expect(() => createTeacherSessionToken(
      claims({ expiresAt: 100_000 }),
      secret
    )).toThrowError(expect.objectContaining({ code: "INVALID_SESSION" }));
    expect(verifyTeacherSessionToken(
      signPayload(claims({ expiresAt: 100_000 })),
      secret,
      1_500
    )).toBeNull();
  });

  it("requires the exact claim key set and canonical field types", () => {
    expect(verifyTeacherSessionToken(signPayload({
      ...claims(),
      role: "teacher"
    }), secret, 1_500)).toBeNull();
    expect(verifyTeacherSessionToken(signPayload({
      ...claims(),
      issuedAt: "1000"
    }), secret, 1_500)).toBeNull();
    expect(verifyTeacherSessionToken(signPayload({
      ...claims(),
      nonce: "not canonical base64"
    }), secret, 1_500)).toBeNull();
  });

  it("parses only bounded printable independent environment values", () => {
    expect(parseTeacherEnvironment({
      ADVERTISING_GAME_TEACHER_PASSWORD: "classroom-password",
      ADVERTISING_GAME_TEACHER_SESSION_SECRET: secret,
      ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
    })).toEqual({
      password: "classroom-password",
      sessionSecret: secret,
      sessionHours: 8
    });

    for (const environment of [
      {
        ADVERTISING_GAME_TEACHER_PASSWORD: "line\nbreak",
        ADVERTISING_GAME_TEACHER_SESSION_SECRET: secret,
        ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
      },
      {
        ADVERTISING_GAME_TEACHER_PASSWORD: "classroom-password",
        ADVERTISING_GAME_TEACHER_SESSION_SECRET: `short\0secret`,
        ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
      },
      {
        ADVERTISING_GAME_TEACHER_PASSWORD: "same-value".repeat(4),
        ADVERTISING_GAME_TEACHER_SESSION_SECRET: "same-value".repeat(4),
        ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
      },
      {
        ADVERTISING_GAME_TEACHER_PASSWORD: "classroom-password",
        ADVERTISING_GAME_TEACHER_SESSION_SECRET: secret,
        ADVERTISING_GAME_TEACHER_SESSION_HOURS: "0"
      }
    ]) {
      expect(() => parseTeacherEnvironment(environment)).toThrow(TeacherAuthError);
    }
  });

  it("compares submitted passwords without a length leak or coercion", () => {
    expect(secureTeacherPasswordMatches("classroom-password", "classroom-password")).toBe(true);
    expect(secureTeacherPasswordMatches("wrong", "classroom-password")).toBe(false);
    expect(secureTeacherPasswordMatches("", "classroom-password")).toBe(false);
    expect(secureTeacherPasswordMatches(7, "classroom-password")).toBe(false);
    expect(secureTeacherPasswordMatches("line\nbreak", "classroom-password")).toBe(false);
  });

  it("serialises and clears one secure teacher-only cookie", () => {
    expect(serialiseTeacherCookie("token", 3_600)).toBe(
      `${TEACHER_SESSION_COOKIE}=token; Path=/api/teacher; HttpOnly; Secure; ` +
      "SameSite=Strict; Max-Age=3600"
    );
    expect(clearTeacherCookie()).toBe(
      `${TEACHER_SESSION_COOKIE}=; Path=/api/teacher; HttpOnly; Secure; ` +
      "SameSite=Strict; Max-Age=0"
    );
  });

  it("requires a valid cookie without accepting a duplicate or prefix name", () => {
    const token = createTeacherSessionToken(claims(), secret);
    const environment = {
      password: "classroom-password",
      sessionSecret: secret,
      sessionHours: 8
    };
    expect(requireTeacherSession(new Request("https://game.example/api/teacher/accounts", {
      headers: { cookie: `${TEACHER_SESSION_COOKIE}=${token}` }
    }), environment, 1_500)).toEqual(claims());

    for (const cookie of [
      "",
      `prefix_${TEACHER_SESSION_COOKIE}=${token}`,
      `${TEACHER_SESSION_COOKIE}=${token}; ${TEACHER_SESSION_COOKIE}=${token}`,
      `${TEACHER_SESSION_COOKIE}=forged`
    ]) {
      expect(() => requireTeacherSession(
        new Request("https://game.example/api/teacher/accounts", {
          headers: { cookie }
        }),
        environment,
        1_500
      )).toThrowError(expect.objectContaining({ code: "AUTHENTICATION_REQUIRED" }));
    }
  });
});
