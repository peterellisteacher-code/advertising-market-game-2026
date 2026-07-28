// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ACCESS_COOKIE,
  ACCOUNT_IDENTITY_HEADER,
  ACCOUNT_REFRESH_COOKIE,
  ACCOUNT_RESET_GENERATION_COOKIE,
  accountIdentityMatches,
  clearAccountSessionCookies,
  clearAccountAccessCookie,
  clearAccountRefreshCookie,
  clearAccountResetGenerationCookie,
  deriveSyntheticAccountEmail,
  invalidCredentialsResponse,
  normaliseAccountUsername,
  serialiseAccountAccessCookie,
  serialiseAccountRefreshCookie,
  serialiseAccountResetGenerationCookie,
  serialiseAccountSessionCookies
} from "./account-primitives";

const secret = "test-only-test-only-test-only-test-only";

describe("account username primitives", () => {
  it("normalises NFKC, surrounding whitespace and case before validation", () => {
    expect(normaliseAccountUsername("  ＭＡＲＫＥＴ_７  ")).toBe("market_7");
    expect(normaliseAccountUsername("Team-Rocket")).toBe("team-rocket");
  });

  it("accepts only 3-24 safe characters beginning with an ASCII letter or digit", () => {
    expect(normaliseAccountUsername("a_1")).toBe("a_1");
    expect(normaliseAccountUsername("a".repeat(24))).toBe("a".repeat(24));

    for (const value of [
      "ab",
      "a".repeat(25),
      "-team",
      "_team",
      "team.name",
      "téam",
      "team name"
    ]) {
      expect(() => normaliseAccountUsername(value), value).toThrow("Username is invalid");
    }
  });

  it("derives a stable opaque synthetic email without embedding the visible username", () => {
    const email = deriveSyntheticAccountEmail("Team-Kilo", secret);

    expect(email).toBe(
      "53ae2a8f244e5759e98eaa46e5b6bb56edbd136fea045ba3db41eefafb7ca9e8" +
      "@accounts.admarket.invalid"
    );
    expect(email).not.toContain("team-kilo");
    expect(email.endsWith(".invalid")).toBe(true);
    expect(deriveSyntheticAccountEmail("team-kilo", secret)).toBe(email);
    expect(deriveSyntheticAccountEmail("team-lima", secret)).not.toBe(email);
  });

  it("requires a server secret with at least 32 UTF-8 bytes", () => {
    expect(() => deriveSyntheticAccountEmail("team-kilo", "")).toThrow(
      "Synthetic email secret is invalid"
    );
    expect(() => deriveSyntheticAccountEmail("team-kilo", "s".repeat(31))).toThrow(
      "Synthetic email secret is invalid"
    );
  });
});

describe("account authentication responses", () => {
  it("returns one no-store response for every invalid credential outcome", async () => {
    const first = invalidCredentialsResponse();
    const second = invalidCredentialsResponse();

    expect(first.status).toBe(401);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(first.headers.get("content-type")).toContain("application/json");
    expect(await first.json()).toEqual({ error: "INVALID_CREDENTIALS" });
    expect(await second.text()).toBe('{"error":"INVALID_CREDENTIALS"}');
  });
});

describe("account request identity binding", () => {
  it("accepts only the exact canonical account header value", () => {
    const request = new Request("https://game.example/api/account/progress", {
      headers: { [ACCOUNT_IDENTITY_HEADER]: "team-two" }
    });

    expect(accountIdentityMatches(request, "team-two")).toBe(true);
    expect(accountIdentityMatches(request, "team-one")).toBe(false);
    expect(accountIdentityMatches(new Request(request.url), "team-two")).toBe(false);
    expect(accountIdentityMatches(new Request(request.url, {
      headers: { [ACCOUNT_IDENTITY_HEADER]: "team-two, team-one" }
    }), "team-two")).toBe(false);
  });
});

describe("account authentication cookies", () => {
  it("serialises an API-scoped secure access cookie for account-bound services", () => {
    expect(serialiseAccountAccessCookie("header.payload.signature", 900, true)).toBe(
      `${ACCOUNT_ACCESS_COOKIE}=header.payload.signature; Path=/api; HttpOnly; ` +
      "SameSite=Strict; Max-Age=900; Secure"
    );
  });

  it("serialises a refresh cookie for account-bound API endpoints", () => {
    expect(serialiseAccountRefreshCookie("refresh-token_1", 604_800.9, true)).toBe(
      `${ACCOUNT_REFRESH_COOKIE}=refresh-token_1; Path=/api; HttpOnly; ` +
      "SameSite=Strict; Max-Age=604800; Secure"
    );
  });

  it("serialises an opaque reset generation alongside the account session", () => {
    expect(serialiseAccountResetGenerationCookie(
      "7440e792-3ddc-4484-ae32-a53088d0d679",
      604_800.9,
      true
    )).toBe(
      `${ACCOUNT_RESET_GENERATION_COOKIE}=7440e792-3ddc-4484-ae32-a53088d0d679; ` +
      "Path=/api; HttpOnly; SameSite=Strict; Max-Age=604800; Secure"
    );
    expect(() => serialiseAccountResetGenerationCookie("not-a-generation", 10, true))
      .toThrow("Account reset generation is invalid");
  });

  it("serialises and clears the complete three-cookie session boundary", () => {
    expect(serialiseAccountSessionCookies({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900
    }, "7440e792-3ddc-4484-ae32-a53088d0d679", 604_800, true)).toHaveLength(3);
    expect(serialiseAccountSessionCookies({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 900
    }, null, 604_800, true)[2]).toContain(
      `${ACCOUNT_RESET_GENERATION_COOKIE}=;`
    );
    expect(clearAccountSessionCookies(true)).toHaveLength(3);
  });

  it("retains defensive flags for local HTTP while omitting only Secure", () => {
    expect(serialiseAccountAccessCookie("token", -10, false)).toBe(
      `${ACCOUNT_ACCESS_COOKIE}=token; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0`
    );
  });

  it("rejects cookie injection and non-finite expiry values", () => {
    expect(() => serialiseAccountAccessCookie("token; admin=true", 10, true))
      .toThrow("Account cookie token is invalid");
    expect(() => serialiseAccountRefreshCookie("token\r\nSet-Cookie: attack=1", 10, true))
      .toThrow("Account cookie token is invalid");
    expect(() => serialiseAccountAccessCookie("token", Number.NaN, true))
      .toThrow("Account cookie lifetime is invalid");
  });

  it("expires all account cookies with their original scopes and secure flags", () => {
    expect(clearAccountAccessCookie(true)).toBe(
      `${ACCOUNT_ACCESS_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0; Secure`
    );
    expect(clearAccountRefreshCookie(true)).toBe(
      `${ACCOUNT_REFRESH_COOKIE}=; Path=/api; HttpOnly; ` +
      "SameSite=Strict; Max-Age=0; Secure"
    );
    expect(clearAccountResetGenerationCookie(true)).toBe(
      `${ACCOUNT_RESET_GENERATION_COOKIE}=; Path=/api; HttpOnly; ` +
      "SameSite=Strict; Max-Age=0; Secure"
    );
  });
});
