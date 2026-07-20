// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  IMAGE_LAB_COOKIE,
  ImageLabAuthError,
  consumeAllowance,
  createCapability,
  createJobToken,
  parseImageLabEnvironment,
  readCapability,
  readJobToken,
  secureCodeMatches,
  serialiseCapabilityCookie,
  serialiseExpiredCapabilityCookie
} from "./image-lab-auth";

const secret = "0123456789abcdef0123456789abcdef";

const readyEnvironment = {
  IMAGE_LAB_ENABLED: "true",
  IMAGE_LAB_SCHOOL_APPROVED: "true",
  IMAGE_LAB_ACCOUNT_CAP_USD: "2.00",
  IMAGE_LAB_CLASSROOM_CODE: "Market-2026!",
  IMAGE_LAB_SIGNING_SECRET: secret,
  FAL_KEY: "fal-key"
} as const;

describe("image-lab environment gate", () => {
  it("stays disabled until every teacher-owned gate is present", () => {
    expect(parseImageLabEnvironment({})).toEqual({ enabled: false, reason: "disabled" });
    expect(parseImageLabEnvironment({ ...readyEnvironment, IMAGE_LAB_SCHOOL_APPROVED: "false" }))
      .toEqual({ enabled: false, reason: "school-approval-required" });
    expect(parseImageLabEnvironment({ ...readyEnvironment, IMAGE_LAB_ACCOUNT_CAP_USD: "0" }))
      .toEqual({ enabled: false, reason: "account-cap-required" });
    expect(parseImageLabEnvironment({ ...readyEnvironment, FAL_KEY: undefined }))
      .toEqual({ enabled: false, reason: "server-configuration-required" });
  });

  it("returns bounded, server-only settings when ready", () => {
    expect(parseImageLabEnvironment(readyEnvironment)).toEqual({
      enabled: true,
      accountCapUsd: 2,
      classroomCode: "Market-2026!",
      falKey: "fal-key",
      signingSecret: secret,
      sessionMinutes: 75,
      objectAllowance: 6,
      realiseAllowance: 2
    });
    expect(parseImageLabEnvironment({
      ...readyEnvironment,
      IMAGE_LAB_SESSION_MINUTES: "999",
      IMAGE_LAB_OBJECT_ALLOWANCE: "999",
      IMAGE_LAB_REALISE_ALLOWANCE: "999"
    })).toMatchObject({ sessionMinutes: 240, objectAllowance: 12, realiseAllowance: 4 });
  });

  it("does not require or recognise the retired fal minor-use approval switch", () => {
    expect(parseImageLabEnvironment({
      ...readyEnvironment,
      IMAGE_LAB_FAL_MINOR_USE_APPROVED: "false"
    })).toMatchObject({ enabled: true, sessionMinutes: 75 });
  });
});

describe("image-lab capability", () => {
  it("compares the classroom code without accepting near matches", () => {
    expect(secureCodeMatches("Market-2026!", "Market-2026!")).toBe(true);
    expect(secureCodeMatches("Market-2026?", "Market-2026!")).toBe(false);
    expect(secureCodeMatches("short", "Market-2026!")).toBe(false);
  });

  it("signs, verifies and binds an allowance to one pair", () => {
    const token = createCapability({
      sessionId: "session-a",
      teamId: "pair-3",
      remainingObject: 6,
      remainingRealise: 2,
      expiresAt: 2_000
    }, secret);
    expect(readCapability(token, secret, 1_999)).toEqual({
      version: 1,
      sessionId: "session-a",
      teamId: "pair-3",
      remainingObject: 6,
      remainingRealise: 2,
      expiresAt: 2_000
    });
    expect(() => readCapability(`${token}x`, secret, 1_999)).toThrow(ImageLabAuthError);
    expect(() => readCapability(token, secret, 2_000)).toThrow("expired");
  });

  it("decrements only the requested stage and refuses exhausted allowances", () => {
    const capability = {
      version: 1 as const,
      sessionId: "session-a",
      teamId: "pair-3",
      remainingObject: 1,
      remainingRealise: 1,
      expiresAt: 2_000
    };
    expect(consumeAllowance(capability, "object-forge")).toMatchObject({
      remainingObject: 0,
      remainingRealise: 1
    });
    expect(consumeAllowance(capability, "make-it-real")).toMatchObject({
      remainingObject: 1,
      remainingRealise: 0
    });
    expect(() => consumeAllowance({ ...capability, remainingObject: 0 }, "object-forge"))
      .toThrow("allowance");
  });

  it("serialises a scoped HttpOnly cookie", () => {
    const cookie = serialiseCapabilityCookie("signed-value", 3_600, true);
    expect(cookie).toContain(`${IMAGE_LAB_COOKIE}=signed-value`);
    expect(cookie).toContain("Path=/api/image-lab");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=3600");
  });
});

describe("image-lab capability cookie lifecycle", () => {
  it("serialises a deletion cookie with the same restrictive scope", () => {
    expect(serialiseExpiredCapabilityCookie(true)).toBe(
      `${IMAGE_LAB_COOKIE}=; Path=/api/image-lab; HttpOnly; SameSite=Strict; Max-Age=0; Secure`
    );
  });
});

describe("image-lab job tokens", () => {
  it("keeps the server-side job identity confidential in the browser token", () => {
    const jobId = "123e4567-e89b-42d3-a456-426614174000";
    const token = createJobToken({
      jobId,
      stage: "object-forge",
      profileId: "object-forge-v1",
      sessionId: "session-a",
      teamId: "pair-3",
      expiresAt: 2_000
    }, secret);

    expect(token).toMatch(/^j1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token).not.toContain(jobId);
    expect(token.split(".").slice(1).map((part) =>
      Buffer.from(part!, "base64url").toString("utf8")).join("\n"))
      .not.toContain(jobId);
  });

  it("binds a fal request to its stage, profile and pair", () => {
    const token = createJobToken({
      jobId: "123e4567-e89b-42d3-a456-426614174000",
      stage: "object-forge",
      profileId: "flux-schnell",
      sessionId: "session-a",
      teamId: "pair-3",
      expiresAt: 2_000
    }, secret);
    expect(readJobToken(token, secret, {
      sessionId: "session-a",
      teamId: "pair-3",
      nowSeconds: 1_999
    })).toMatchObject({
      jobId: "123e4567-e89b-42d3-a456-426614174000",
      stage: "object-forge",
      profileId: "flux-schnell"
    });
    expect(() => readJobToken(token, secret, {
      sessionId: "session-a",
      teamId: "pair-4",
      nowSeconds: 1_999
    })).toThrow("pair");
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(() => readJobToken(tampered, secret, {
      sessionId: "session-a",
      teamId: "pair-3",
      nowSeconds: 1_999
    })).toThrow(ImageLabAuthError);
  });
});
