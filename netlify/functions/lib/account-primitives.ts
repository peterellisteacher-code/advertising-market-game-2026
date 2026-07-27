import { createHmac } from "node:crypto";

export const ACCOUNT_ACCESS_COOKIE = "admarket_account_access";
export const ACCOUNT_IDENTITY_HEADER = "x-admarket-account";
export const ACCOUNT_REFRESH_COOKIE = "admarket_account_refresh";
export const ACCOUNT_RESET_GENERATION_COOKIE = "admarket_account_reset";

const ACCOUNT_USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const COOKIE_TOKEN_PATTERN = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]{1,4096}$/u;
const RESET_GENERATION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SYNTHETIC_EMAIL_CONTEXT = "admarket-account-v1\\0";
const SYNTHETIC_EMAIL_DOMAIN = "accounts.admarket.invalid";

export function normaliseAccountUsername(value: unknown): string {
  if (typeof value !== "string") throw new Error("Username is invalid");
  const normalised = value.normalize("NFKC").trim().toLowerCase();
  if (!ACCOUNT_USERNAME_PATTERN.test(normalised)) throw new Error("Username is invalid");
  return normalised;
}

export function deriveSyntheticAccountEmail(username: unknown, secret: unknown): string {
  const normalised = normaliseAccountUsername(username);
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Synthetic email secret is invalid");
  }
  const digest = createHmac("sha256", secret)
    .update(`${SYNTHETIC_EMAIL_CONTEXT}${normalised}`, "utf8")
    .digest("hex");
  return `${digest}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export function invalidCredentialsResponse(): Response {
  return Response.json({ error: "INVALID_CREDENTIALS" }, {
    status: 401,
    headers: { "cache-control": "no-store" }
  });
}

export function accountIdentityMatches(request: Request, username: string): boolean {
  return request.headers.get(ACCOUNT_IDENTITY_HEADER) === username;
}

function serialiseAccountCookie(
  name: string,
  token: string,
  path: "/" | "/api",
  maxAgeSeconds: number,
  secure: boolean
): string {
  if (!COOKIE_TOKEN_PATTERN.test(token)) throw new Error("Account cookie token is invalid");
  if (!Number.isFinite(maxAgeSeconds)) throw new Error("Account cookie lifetime is invalid");
  const parts = [
    `${name}=${token}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function serialiseAccountAccessCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  return serialiseAccountCookie(
    ACCOUNT_ACCESS_COOKIE,
    token,
    "/api",
    maxAgeSeconds,
    secure
  );
}

export function serialiseAccountRefreshCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  return serialiseAccountCookie(
    ACCOUNT_REFRESH_COOKIE,
    token,
    "/api",
    maxAgeSeconds,
    secure
  );
}

export function serialiseAccountResetGenerationCookie(
  generation: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  if (!RESET_GENERATION_PATTERN.test(generation)) {
    throw new Error("Account reset generation is invalid");
  }
  return serialiseAccountCookie(
    ACCOUNT_RESET_GENERATION_COOKIE,
    generation,
    "/api",
    maxAgeSeconds,
    secure
  );
}

export interface AccountSessionCookieTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export function serialiseAccountSessionCookies(
  tokens: AccountSessionCookieTokens,
  resetGeneration: string | null,
  refreshMaxAgeSeconds: number,
  secure: boolean
): readonly string[] {
  return [
    serialiseAccountAccessCookie(tokens.accessToken, tokens.expiresIn, secure),
    serialiseAccountRefreshCookie(tokens.refreshToken, refreshMaxAgeSeconds, secure),
    resetGeneration === null
      ? clearAccountResetGenerationCookie(secure)
      : serialiseAccountResetGenerationCookie(
        resetGeneration,
        refreshMaxAgeSeconds,
        secure
      )
  ];
}

function clearAccountCookie(
  name: string,
  path: "/" | "/api",
  secure: boolean
): string {
  const parts = [
    `${name}=`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearAccountAccessCookie(secure: boolean): string {
  return clearAccountCookie(ACCOUNT_ACCESS_COOKIE, "/api", secure);
}

export function clearAccountRefreshCookie(secure: boolean): string {
  return clearAccountCookie(ACCOUNT_REFRESH_COOKIE, "/api", secure);
}

export function clearAccountResetGenerationCookie(secure: boolean): string {
  return clearAccountCookie(ACCOUNT_RESET_GENERATION_COOKIE, "/api", secure);
}

export function clearAccountSessionCookies(secure: boolean): readonly string[] {
  return [
    clearAccountAccessCookie(secure),
    clearAccountRefreshCookie(secure),
    clearAccountResetGenerationCookie(secure)
  ];
}
