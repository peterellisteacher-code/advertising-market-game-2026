const VALIDATED_ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;

const hex = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

export async function accountStorageNamespace(username: string): Promise<string> {
  if (!VALIDATED_ACCOUNT_USERNAME.test(username)) {
    throw new Error("Account storage requires a validated username");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(username)
  );
  return hex(digest);
}
